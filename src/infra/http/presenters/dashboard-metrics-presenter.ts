type DashboardOverviewMetrics = {
  totalRevenueInCents: number;
  averageTicketInCents: number;
  appointmentsCount: number;
  cancellationRate: number;
};

type DashboardRevenuePoint = {
  period: string;
  revenueInCents: number;
  appointmentsCount: number;
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

  static toRevenue(points: DashboardRevenuePoint[]) {
    return {
      points,
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
