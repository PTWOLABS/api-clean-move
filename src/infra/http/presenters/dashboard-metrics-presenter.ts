type DashboardOverviewMetrics = {
  totalRevenueInCents: number;
  averageTicketInCents: number;
  appointmentsCount: number;
  cancellationRate: number;
};

type DashboardRevenuePoint = {
  date: string;
  label: string;
  revenueInCents: number;
  appointments: number;
};

type DashboardRevenueSummary = {
  revenueInCents: number;
  appointments: number;
  revenueTrendPercent: number | null;
  appointmentsTrendPercent: number | null;
};

type DashboardAppointmentMetrics = {
  appointmentsCount: number;
  cancellationRate: number;
};

type DashboardPopularService = {
  serviceId: string;
  serviceName: string;
  category: string | null;
  appointmentsCount: number;
  revenueInCents: number;
};

export class DashboardMetricsPresenter {
  static toOverview(metrics: DashboardOverviewMetrics) {
    return metrics;
  }

  static toRevenue(
    points: DashboardRevenuePoint[],
    summary: DashboardRevenueSummary,
  ) {
    return {
      points,
      summary,
    };
  }

  static toAppointments(metrics: DashboardAppointmentMetrics) {
    return metrics;
  }

  static toPopularServices(popularServices: DashboardPopularService[]) {
    return {
      popularServices,
    };
  }
}
