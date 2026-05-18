type DashboardOverviewMetrics = {
  appointments: {
    value: number;
    variationPercentage: number | null;
    points: Array<{
      date: string;
      label: string;
      value: number;
    }>;
  };
  averageTicket: {
    valueInCents: number;
    variationPercentage: number | null;
    points: Array<{
      date: string;
      label: string;
      valueInCents: number;
    }>;
  };
  cancellationRate: {
    value: number;
    variationInPercentagePoints: number | null;
    points: Array<{
      date: string;
      label: string;
      value: number;
    }>;
  };
  totalRevenue: {
    valueInCents: number;
    variationPercentage: number | null;
    points: Array<{
      date: string;
      label: string;
      valueInCents: number;
    }>;
  };
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
  cancellationRate: {
    currentPercent: number;
    comparisonPercentPoints: number | null;
  };
};

type DashboardPopularService = {
  id: string;
  name: string;
  completedCount: number;
  percent: number;
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

  static toPopularServices(
    popularServices: DashboardPopularService[],
    totalServices: number,
  ) {
    return {
      popularServices,
      totalServices,
    };
  }
}
