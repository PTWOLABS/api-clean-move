import { Quote } from "../../modules/quotes/domain/entities/quote";
import { QuotedServiceSnapshot } from "../../modules/quotes/domain/value-objects/quoted-service-snapshot";
import {
  formatAddress,
  formatCurrency,
  formatDiscount,
  formatDocument,
  formatDuration,
  formatPaymentMethod,
  formatPhone,
  formatQuoteDate,
} from "./quote-pdf-formatters";

const COLORS = {
  ink: "#171717",
  graphite: "#303236",
  muted: "#696B70",
  line: "#D9DADD",
  surface: "#F4F4F3",
  surfaceStrong: "#E9E9E7",
  white: "#FFFFFF",
};

const PAGE = {
  horizontalMargin: 46,
  top: 42,
  bottom: 64,
  sectionGap: 22,
};

type InfoItem = {
  label: string;
  value: string;
};

export class PdfkitQuoteLayout {
  private readonly contentWidth: number;
  private cursorY = PAGE.top;

  constructor(private readonly document: PDFKit.PDFDocument) {
    this.contentWidth = this.document.page.width - PAGE.horizontalMargin * 2;
  }

  render(quote: Quote, logo: Buffer | null) {
    this.renderDocumentHeader(quote, logo);
    this.renderEstablishment(quote);
    this.renderCustomerAndVehicle(quote);
    this.renderServices(quote);
    this.renderFinancialSummary(quote);
    this.renderPaymentOptions(quote);

    if (quote.description) {
      this.renderTextSection("Observações", quote.description);
    }

    if (quote.termsAndConditions) {
      this.renderTextSection("Termos e condições", quote.termsAndConditions);
    }

    this.renderFooters(quote);
  }

  private renderDocumentHeader(quote: Quote, logo: Buffer | null) {
    const headerTop = this.cursorY;
    const logoWidth = 205;
    const logoHeight = 62;
    const renderedLogo = logo
      ? this.tryRenderLogo(logo, headerTop, logoWidth, logoHeight)
      : false;

    if (!renderedLogo) {
      this.renderLogoFallback(
        quote.establishment.name,
        headerTop,
        logoWidth,
        logoHeight,
      );
    }

    const titleX = PAGE.horizontalMargin + 285;
    const titleWidth = this.contentWidth - 285;

    this.document
      .fillColor(COLORS.muted)
      .font("Helvetica-Bold")
      .fontSize(7.5)
      .text("DOCUMENTO COMERCIAL", titleX, headerTop + 2, {
        align: "right",
        characterSpacing: 1.25,
        width: titleWidth,
      });

    this.document
      .fillColor(COLORS.ink)
      .font("Times-Bold")
      .fontSize(25)
      .text("ORÇAMENTO", titleX, headerTop + 17, {
        align: "right",
        width: titleWidth,
      });

    this.document
      .fillColor(COLORS.muted)
      .font("Helvetica")
      .fontSize(8)
      .text(
        `Emitido em ${formatQuoteDate(quote.createdAt)}`,
        titleX,
        headerTop + 45,
        {
          align: "right",
          width: titleWidth,
        },
      );

    if (quote.expiresAt) {
      this.document.text(
        `Válido até ${formatQuoteDate(quote.expiresAt)}`,
        titleX,
        headerTop + 57,
        {
          align: "right",
          width: titleWidth,
        },
      );
    }

    this.cursorY = headerTop + 80;
    this.drawRule(this.cursorY);
    this.cursorY += 16;
  }

  private tryRenderLogo(
    logo: Buffer,
    y: number,
    width: number,
    height: number,
  ) {
    try {
      this.document.image(logo, PAGE.horizontalMargin, y, {
        fit: [width, height],
        valign: "center",
      });

      return true;
    } catch {
      return false;
    }
  }

  private renderLogoFallback(
    establishmentName: string,
    y: number,
    width: number,
    height: number,
  ) {
    const monogramSize = 52;
    const initials = establishmentName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join("");

    this.document
      .save()
      .roundedRect(PAGE.horizontalMargin, y, monogramSize, monogramSize, 4)
      .fill(COLORS.ink);

    this.document
      .fillColor(COLORS.white)
      .font("Times-Bold")
      .fontSize(19)
      .text(initials || "CM", PAGE.horizontalMargin, y + 16, {
        align: "center",
        width: monogramSize,
      });

    this.document
      .fillColor(COLORS.ink)
      .font("Helvetica-Bold")
      .fontSize(11)
      .text(
        establishmentName,
        PAGE.horizontalMargin + monogramSize + 12,
        y + 12,
        {
          height,
          lineGap: 2,
          width: width - monogramSize - 12,
        },
      )
      .restore();
  }

  private renderEstablishment(quote: Quote) {
    const establishment = quote.establishment;
    const address = formatAddress(establishment.address);

    this.document
      .fillColor(COLORS.ink)
      .font("Helvetica-Bold")
      .fontSize(11.5)
      .text(establishment.name, PAGE.horizontalMargin, this.cursorY, {
        width: this.contentWidth,
      });

    this.cursorY = this.document.y + 3;

    const details = [
      establishment.legalBusinessName !== establishment.name
        ? establishment.legalBusinessName
        : null,
      `CNPJ ${formatDocument(establishment.cnpj)}`,
      address,
    ].filter((value): value is string => Boolean(value));

    this.document
      .fillColor(COLORS.muted)
      .font("Helvetica")
      .fontSize(8.5)
      .text(details.join("\n"), PAGE.horizontalMargin, this.cursorY, {
        lineGap: 2.5,
        width: this.contentWidth,
      });

    this.cursorY = this.document.y + PAGE.sectionGap;
  }

  private renderCustomerAndVehicle(quote: Quote) {
    const gap = 12;
    const cardWidth = (this.contentWidth - gap) / 2;
    const customerAddress = formatAddress(quote.customer.address);
    const customerItems: InfoItem[] = [
      { label: "Nome", value: quote.customer.name },
      ...(quote.customer.phone
        ? [{ label: "Telefone", value: formatPhone(quote.customer.phone) }]
        : []),
      ...(quote.customer.cpfCnpj
        ? [
            {
              label: "CPF / CNPJ",
              value: formatDocument(quote.customer.cpfCnpj),
            },
          ]
        : []),
      ...(quote.customer.email
        ? [{ label: "E-mail", value: quote.customer.email }]
        : []),
      ...(customerAddress
        ? [{ label: "Endereço", value: customerAddress }]
        : []),
    ];
    const vehicleItems = this.getVehicleItems(quote);
    const customerHeight = this.measureInfoCard(customerItems, cardWidth);
    const vehicleHeight = this.measureInfoCard(vehicleItems, cardWidth);
    const cardHeight = Math.max(customerHeight, vehicleHeight);

    this.ensureSpace(cardHeight);
    this.renderInfoCard(
      "Cliente",
      customerItems,
      PAGE.horizontalMargin,
      this.cursorY,
      cardWidth,
      cardHeight,
    );
    this.renderInfoCard(
      "Veículo",
      vehicleItems,
      PAGE.horizontalMargin + cardWidth + gap,
      this.cursorY,
      cardWidth,
      cardHeight,
    );

    this.cursorY += cardHeight + PAGE.sectionGap;
  }

  private getVehicleItems(quote: Quote): InfoItem[] {
    if (!quote.vehicle) {
      return [{ label: "Dados", value: "Não informado" }];
    }

    const vehicleName =
      [quote.vehicle.brand, quote.vehicle.model].filter(Boolean).join(" ") ||
      "Não informado";

    return [
      { label: "Marca / modelo", value: vehicleName },
      ...(quote.vehicle.year
        ? [{ label: "Ano", value: String(quote.vehicle.year) }]
        : []),
      ...(quote.vehicle.plate
        ? [{ label: "Placa", value: quote.vehicle.plate.toUpperCase() }]
        : []),
      ...(quote.vehicle.color
        ? [{ label: "Cor", value: quote.vehicle.color }]
        : []),
    ];
  }

  private measureInfoCard(items: InfoItem[], width: number) {
    let height = 42;

    for (const item of items) {
      this.document.font("Helvetica").fontSize(9);
      height +=
        13 +
        this.document.heightOfString(item.value, {
          lineGap: 1,
          width: width - 28,
        }) +
        7;
    }

    return height;
  }

  private renderInfoCard(
    title: string,
    items: InfoItem[],
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    this.document
      .save()
      .roundedRect(x, y, width, height, 4)
      .fillAndStroke(COLORS.surface, COLORS.line)
      .rect(x, y, 4, height)
      .fill(COLORS.graphite);

    this.document
      .fillColor(COLORS.ink)
      .font("Times-Bold")
      .fontSize(13)
      .text(title, x + 16, y + 14, { width: width - 30 });

    let itemY = y + 42;

    for (const item of items) {
      this.document
        .fillColor(COLORS.muted)
        .font("Helvetica-Bold")
        .fontSize(6.7)
        .text(item.label.toUpperCase(), x + 16, itemY, {
          characterSpacing: 0.6,
          width: width - 28,
        });

      itemY += 11;

      this.document
        .fillColor(COLORS.ink)
        .font("Helvetica")
        .fontSize(9)
        .text(item.value, x + 16, itemY, {
          lineGap: 1,
          width: width - 28,
        });

      itemY = this.document.y + 7;
    }

    this.document.restore();
  }

  private renderServices(quote: Quote) {
    const firstService = quote.services[0];
    const firstRowHeight = firstService
      ? this.measureServiceRow(firstService)
      : 0;

    this.ensureSpace(50 + firstRowHeight);
    this.renderSectionTitle("Serviços");
    this.renderServiceTableHeader();

    quote.services.forEach((service, index) => {
      const rowHeight = this.measureServiceRow(service);

      this.ensureSpace(rowHeight, () => this.renderServiceTableHeader());
      this.renderServiceRow(service, index, rowHeight);
    });

    this.cursorY += 5;
  }

  private renderServiceTableHeader() {
    const headerHeight = 25;

    this.document
      .save()
      .rect(
        PAGE.horizontalMargin,
        this.cursorY,
        this.contentWidth,
        headerHeight,
      )
      .fill(COLORS.graphite);

    this.document
      .fillColor(COLORS.white)
      .font("Helvetica-Bold")
      .fontSize(7.2)
      .text("DESCRIÇÃO", PAGE.horizontalMargin + 13, this.cursorY + 9, {
        characterSpacing: 0.8,
        width: this.contentWidth - 150,
      })
      .text(
        "VALOR",
        PAGE.horizontalMargin + this.contentWidth - 125,
        this.cursorY + 9,
        {
          align: "right",
          characterSpacing: 0.8,
          width: 112,
        },
      )
      .restore();

    this.cursorY += headerHeight;
  }

  private measureServiceRow(service: QuotedServiceSnapshot) {
    this.document.font("Helvetica-Bold").fontSize(9.2);
    const descriptionHeight = this.document.heightOfString(
      service.serviceName,
      {
        lineGap: 1.5,
        width: this.contentWidth - 165,
      },
    );
    const metadataHeight =
      service.category || service.durationInMinutes ? 13 : 0;

    return Math.max(38, 17 + descriptionHeight + metadataHeight);
  }

  private renderServiceRow(
    service: QuotedServiceSnapshot,
    index: number,
    height: number,
  ) {
    const x = PAGE.horizontalMargin;
    const y = this.cursorY;
    const descriptionWidth = this.contentWidth - 165;
    const metadata = [
      service.category?.name,
      service.durationInMinutes
        ? formatDuration(service.durationInMinutes)
        : null,
    ]
      .filter(Boolean)
      .join("  •  ");

    this.document
      .save()
      .rect(x, y, this.contentWidth, height)
      .fill(index % 2 === 0 ? COLORS.surface : COLORS.white)
      .rect(x, y, this.contentWidth, height)
      .stroke(COLORS.line);

    this.document
      .fillColor(COLORS.ink)
      .font("Helvetica-Bold")
      .fontSize(9.2)
      .text(service.serviceName, x + 13, y + 11, {
        lineGap: 1.5,
        width: descriptionWidth,
      });

    const descriptionBottom = this.document.y;

    if (metadata) {
      this.document
        .fillColor(COLORS.muted)
        .font("Helvetica")
        .fontSize(7.5)
        .text(metadata, x + 13, descriptionBottom + 4, {
          width: descriptionWidth,
        });
    }

    const valueX = x + this.contentWidth - 137;

    if (service.isCourtesy) {
      this.document
        .fillColor(COLORS.muted)
        .font("Helvetica")
        .fontSize(8.5)
        .text(formatCurrency(service.priceInCents), valueX, y + 9, {
          align: "right",
          width: 124,
        });

      const badgeWidth = 58;
      const badgeX = valueX + 124 - badgeWidth;

      this.document
        .roundedRect(badgeX, y + 23, badgeWidth, 13, 2)
        .fill(COLORS.surfaceStrong)
        .fillColor(COLORS.graphite)
        .font("Helvetica-Bold")
        .fontSize(6.2)
        .text("CORTESIA", badgeX, y + 27, {
          align: "center",
          characterSpacing: 0.55,
          width: badgeWidth,
        });
    } else {
      this.document
        .fillColor(COLORS.ink)
        .font("Helvetica-Bold")
        .fontSize(9.2)
        .text(formatCurrency(service.priceInCents), valueX, y + 12, {
          align: "right",
          width: 124,
        });
    }

    this.document.restore();
    this.cursorY += height;
  }

  private renderFinancialSummary(quote: Quote) {
    const hasCourtesies = quote.totalCourtesyValueInCents > 0;
    const summaryHeight = hasCourtesies ? 66 : 48;

    this.ensureSpace(summaryHeight + 5);

    const width = 250;
    const x = PAGE.horizontalMargin + this.contentWidth - width;
    const y = this.cursorY;

    this.document
      .save()
      .roundedRect(x, y, width, summaryHeight, 4)
      .fill(COLORS.graphite);

    this.document
      .fillColor(COLORS.white)
      .font("Helvetica")
      .fontSize(8.5)
      .text("Subtotal", x + 15, y + 14, { width: 105 })
      .font("Helvetica-Bold")
      .text(formatCurrency(quote.subtotalInCents), x + 120, y + 14, {
        align: "right",
        width: width - 135,
      });

    if (hasCourtesies) {
      this.document
        .fillColor("#D3D4D6")
        .font("Helvetica")
        .fontSize(8)
        .text("Valor em cortesias", x + 15, y + 36, { width: 120 })
        .font("Helvetica-Bold")
        .text(
          formatCurrency(quote.totalCourtesyValueInCents),
          x + 135,
          y + 36,
          {
            align: "right",
            width: width - 150,
          },
        );
    }

    this.document.restore();
    this.cursorY += summaryHeight + PAGE.sectionGap;
  }

  private renderPaymentOptions(quote: Quote) {
    this.ensureSpace(90);
    this.renderSectionTitle("Formas de pagamento");

    quote.paymentOptions.forEach((option) => {
      const metadata = [
        formatPaymentMethod(option.method),
        `${option.installments} ${
          option.installments === 1 ? "parcela" : "parcelas"
        }`,
        option.method === "CARD" || option.installments > 1
          ? option.interestFree
            ? "sem juros"
            : "com juros"
          : null,
        option.discountType && option.discountValue !== null
          ? formatDiscount(option.discountType, option.discountValue)
          : null,
      ]
        .filter(Boolean)
        .join("  •  ");
      const labelWidth = this.contentWidth - 180;

      this.document.font("Helvetica-Bold").fontSize(9.3);
      const labelHeight = this.document.heightOfString(option.label, {
        width: labelWidth,
      });
      this.document.font("Helvetica").fontSize(7.6);
      const metadataHeight = this.document.heightOfString(metadata, {
        width: labelWidth,
      });
      const rowHeight = Math.max(52, 22 + labelHeight + metadataHeight);

      this.ensureSpace(rowHeight + 7);

      const x = PAGE.horizontalMargin;
      const y = this.cursorY;

      this.document
        .save()
        .roundedRect(x, y, this.contentWidth, rowHeight, 4)
        .fillAndStroke(COLORS.surface, COLORS.line);

      this.document
        .fillColor(COLORS.ink)
        .font("Helvetica-Bold")
        .fontSize(9.3)
        .text(option.label, x + 14, y + 12, {
          width: labelWidth,
        });

      this.document
        .fillColor(COLORS.muted)
        .font("Helvetica")
        .fontSize(7.6)
        .text(metadata, x + 14, this.document.y + 4, {
          width: labelWidth,
        });

      this.document
        .fillColor(COLORS.muted)
        .font("Helvetica-Bold")
        .fontSize(6.5)
        .text("TOTAL", x + this.contentWidth - 145, y + 11, {
          align: "right",
          characterSpacing: 0.6,
          width: 131,
        })
        .fillColor(COLORS.ink)
        .font("Times-Bold")
        .fontSize(14)
        .text(
          formatCurrency(option.totalInCents),
          x + this.contentWidth - 160,
          y + 25,
          {
            align: "right",
            width: 146,
          },
        )
        .restore();

      this.cursorY += rowHeight + 7;
    });

    this.cursorY += PAGE.sectionGap - 7;
  }

  private renderTextSection(title: string, text: string) {
    const textWidth = this.contentWidth - 30;
    let remainingText = text.trim();
    let isContinuation = false;

    while (remainingText) {
      this.ensureSpace(105);
      this.renderSectionTitle(
        isContinuation ? `${title} (continuação)` : title,
      );

      const contentBottom = this.document.page.height - PAGE.bottom;
      const availableTextHeight = contentBottom - this.cursorY - 28;
      const { chunk, remainder } = this.splitTextToFit(
        remainingText,
        textWidth,
        availableTextHeight,
      );
      const textHeight = this.measureBodyText(chunk, textWidth);
      const boxHeight = textHeight + 28;

      this.document
        .save()
        .roundedRect(
          PAGE.horizontalMargin,
          this.cursorY,
          this.contentWidth,
          boxHeight,
          4,
        )
        .fillAndStroke(COLORS.surface, COLORS.line);

      this.document
        .fillColor(COLORS.graphite)
        .font("Helvetica")
        .fontSize(8.5)
        .text(chunk, PAGE.horizontalMargin + 15, this.cursorY + 14, {
          lineGap: 2.5,
          width: textWidth,
        })
        .restore();

      this.cursorY += boxHeight + PAGE.sectionGap;
      remainingText = remainder.trimStart();

      if (remainingText) {
        this.addPage();
        isContinuation = true;
      }
    }
  }

  private splitTextToFit(text: string, width: number, maxHeight: number) {
    const tokens = text.match(/\S+\s*/g) ?? [text];
    let lowerBound = 1;
    let upperBound = tokens.length;
    let fittingTokenCount = 0;

    while (lowerBound <= upperBound) {
      const middle = Math.floor((lowerBound + upperBound) / 2);
      const candidate = tokens.slice(0, middle).join("").trimEnd();

      if (this.measureBodyText(candidate, width) <= maxHeight) {
        fittingTokenCount = middle;
        lowerBound = middle + 1;
      } else {
        upperBound = middle - 1;
      }
    }

    if (fittingTokenCount === 0) {
      return this.splitLongTokenToFit(text, width, maxHeight);
    }

    return {
      chunk: tokens.slice(0, fittingTokenCount).join("").trimEnd(),
      remainder: tokens.slice(fittingTokenCount).join(""),
    };
  }

  private splitLongTokenToFit(text: string, width: number, maxHeight: number) {
    let lowerBound = 1;
    let upperBound = text.length;
    let fittingCharacterCount = 1;

    while (lowerBound <= upperBound) {
      const middle = Math.floor((lowerBound + upperBound) / 2);
      const candidate = text.slice(0, middle);

      if (this.measureBodyText(candidate, width) <= maxHeight) {
        fittingCharacterCount = middle;
        lowerBound = middle + 1;
      } else {
        upperBound = middle - 1;
      }
    }

    return {
      chunk: text.slice(0, fittingCharacterCount),
      remainder: text.slice(fittingCharacterCount),
    };
  }

  private measureBodyText(text: string, width: number) {
    this.document.font("Helvetica").fontSize(8.5);

    return this.document.heightOfString(text, {
      lineGap: 2.5,
      width,
    });
  }

  private renderSectionTitle(title: string) {
    this.ensureSpace(31);

    this.document
      .fillColor(COLORS.ink)
      .font("Times-Bold")
      .fontSize(13.5)
      .text(title, PAGE.horizontalMargin, this.cursorY, {
        width: 220,
      });

    this.document
      .moveTo(PAGE.horizontalMargin + 155, this.cursorY + 8)
      .lineTo(PAGE.horizontalMargin + this.contentWidth, this.cursorY + 8)
      .lineWidth(0.7)
      .stroke(COLORS.line);

    this.cursorY += 25;
  }

  private ensureSpace(height: number, afterPageBreak?: () => void) {
    const contentBottom = this.document.page.height - PAGE.bottom;

    if (this.cursorY + height <= contentBottom) return;

    this.addPage();
    afterPageBreak?.();
  }

  private addPage() {
    this.document.addPage();
    this.cursorY = PAGE.top;

    this.document
      .fillColor(COLORS.muted)
      .font("Helvetica-Bold")
      .fontSize(7.2)
      .text(
        this.document.info.Title ?? "Orçamento",
        PAGE.horizontalMargin,
        this.cursorY,
        {
          characterSpacing: 0.5,
          width: this.contentWidth * 0.7,
        },
      )
      .fillColor(COLORS.ink)
      .font("Times-Bold")
      .fontSize(11)
      .text(
        "ORÇAMENTO",
        PAGE.horizontalMargin + this.contentWidth * 0.7,
        this.cursorY - 2,
        {
          align: "right",
          width: this.contentWidth * 0.3,
        },
      );

    this.cursorY += 24;
    this.drawRule(this.cursorY);
    this.cursorY += 14;
  }

  private renderFooters(quote: Quote) {
    const range = this.document.bufferedPageRange();

    for (let index = range.start; index < range.start + range.count; index++) {
      this.document.switchToPage(index);

      const footerY = this.document.page.height - 42;
      const validity = quote.expiresAt
        ? `Válido até ${formatQuoteDate(quote.expiresAt)}`
        : "Sem data de validade";
      const pageLabel = `Página ${index - range.start + 1} de ${range.count}`;

      this.document
        .save()
        .moveTo(PAGE.horizontalMargin, footerY - 8)
        .lineTo(PAGE.horizontalMargin + this.contentWidth, footerY - 8)
        .lineWidth(0.6)
        .stroke(COLORS.line)
        .fillColor(COLORS.muted)
        .font("Helvetica")
        .fontSize(7)
        .text(
          `Emitido em ${formatQuoteDate(quote.createdAt)}  •  ${validity}`,
          PAGE.horizontalMargin,
          footerY,
          {
            lineBreak: false,
          },
        );

      const pageLabelWidth = this.document.widthOfString(pageLabel);

      this.document
        .text(
          pageLabel,
          PAGE.horizontalMargin + this.contentWidth - pageLabelWidth,
          footerY,
          { lineBreak: false },
        )
        .restore();
    }
  }

  private drawRule(y: number) {
    this.document
      .moveTo(PAGE.horizontalMargin, y)
      .lineTo(PAGE.horizontalMargin + this.contentWidth, y)
      .lineWidth(0.8)
      .stroke(COLORS.ink);
  }
}
