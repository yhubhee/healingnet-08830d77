import { Calendar, Pill, TestTube, MessageSquare } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { AppointmentCard } from "@/components/dashboard/AppointmentCard";
import { PrescriptionCard } from "@/components/dashboard/PrescriptionCard";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { HealthMetrics } from "@/components/dashboard/HealthMetrics";

const upcomingAppointments = [
  {
    doctorName: "Dr. Chidi Adebayo",
    specialty: "General Practitioner",
    date: "Jan 5, 2026",
    time: "10:00 AM",
    type: "virtual" as const,
    status: "approved" as const,
  },
  {
    doctorName: "Dr. Ngozi Okonkwo",
    specialty: "Cardiologist",
    date: "Jan 8, 2026",
    time: "2:30 PM",
    type: "in_person" as const,
    status: "pending" as const,
  },
  {
    doctorName: "Dr. Emeka Nnamdi",
    specialty: "Dermatologist",
    date: "Jan 12, 2026",
    time: "11:00 AM",
    type: "virtual" as const,
    status: "approved" as const,
  },
];

const prescriptions = [
  {
    drugName: "Amoxicillin",
    dosage: "500mg",
    frequency: "3 times daily",
    duration: "7 days",
    doctorName: "Dr. Adebayo",
    status: "active" as const,
    refillAllowed: false,
  },
  {
    drugName: "Metformin",
    dosage: "850mg",
    frequency: "2 times daily",
    duration: "30 days",
    doctorName: "Dr. Okonkwo",
    status: "active" as const,
    refillAllowed: true,
  },
];

export default function Index() {
  return (
    <DashboardLayout>
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground mb-2">
          Welcome back, Adaora! 👋
        </h1>
        <p className="text-muted-foreground">
          Here's an overview of your health journey. Stay healthy!
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Upcoming Appointments"
          value="3"
          subtitle="Next: Jan 5, 2026"
          icon={Calendar}
          variant="primary"
        />
        <StatCard
          title="Active Prescriptions"
          value="2"
          subtitle="1 refill available"
          icon={Pill}
          variant="success"
        />
        <StatCard
          title="Pending Lab Results"
          value="1"
          subtitle="Expected: Jan 4"
          icon={TestTube}
          variant="warning"
        />
        <StatCard
          title="Unread Messages"
          value="3"
          subtitle="From 2 doctors"
          icon={MessageSquare}
          variant="info"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="xl:col-span-2 space-y-6">
          {/* Quick Actions */}
          <QuickActions />

          {/* Upcoming Appointments */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-heading font-bold text-foreground">
                Upcoming Appointments
              </h3>
              <a
                href="/appointments"
                className="text-sm text-primary hover:underline"
              >
                View all
              </a>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcomingAppointments.map((appointment, index) => (
                <AppointmentCard key={index} {...appointment} />
              ))}
            </div>
          </div>

          {/* Active Prescriptions */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-heading font-bold text-foreground">
                Active Prescriptions
              </h3>
              <a
                href="/prescriptions"
                className="text-sm text-primary hover:underline"
              >
                View all
              </a>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {prescriptions.map((prescription, index) => (
                <PrescriptionCard key={index} {...prescription} />
              ))}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Health Metrics */}
          <HealthMetrics />

          {/* Recent Activity */}
          <RecentActivity />
        </div>
      </div>
    </DashboardLayout>
  );
}
