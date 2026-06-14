import { Bell, Search, ChevronDown, Building2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { useHospitalNotifications, useRealtimeNotifications, useMarkNotificationRead } from "@/hooks/useHospitalData";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import { cn } from "@/lib/utils";

export function HospitalHeader() {
  const navigate = useNavigate();
  useRealtimeNotifications();
  const { data: notifications = [] } = useHospitalNotifications();
  const markRead = useMarkNotificationRead();
  const { playSound } = useNotificationSound();

  const unread = notifications.filter((n: any) => !n.is_read);
  const recentNotifs = notifications.slice(0, 3);

  useEffect(() => {
    const callInNotif = unread.find((n: any) => n.type === "call_in");
    if (callInNotif) {
      playSound();
    }
  }, [unread, playSound]);

  return (
    <header className="sticky top-0 z-30 h-16 bg-background/95 backdrop-blur border-b border-border">
      <div className="flex items-center justify-between h-full px-4 lg:px-8">
        <div className="hidden md:flex items-center flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search patients, doctors, records..."
              className="pl-10 bg-card border-border focus-visible:ring-primary"
            />
          </div>
        </div>

        <div className="flex items-center gap-4 ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                {unread.length > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-destructive border-0">
                    {unread.length > 9 ? "9+" : unread.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel className="flex items-center justify-between">
                Notifications
                {unread.length > 0 && <Badge variant="secondary" className="text-xs">{unread.length} new</Badge>}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {recentNotifs.length === 0 ? (
                <div className="py-4 text-center text-sm text-muted-foreground">No notifications</div>
              ) : recentNotifs.map((n: any) => {
                const typeIcons: Record<string, string> = {
                  checkin: "🟢",
                  call_in: "☎️",
                  lab: "🔬",
                  pharmacy: "💊",
                  billing: "💳",
                  consultation: "📋",
                  emergency: "🚨",
                  system: "⚙️"
                };
                return (
                  <DropdownMenuItem
                    key={n.id}
                    className={cn("flex flex-col items-start gap-1 py-3 cursor-pointer", !n.is_read && "bg-primary/5")}
                    onClick={() => !n.is_read && markRead.mutate(n.id)}
                  >
                    <div className="flex items-center gap-2">
                      <span>{typeIcons[n.type] || "📌"}</span>
                      <p className={cn("font-medium text-sm", !n.is_read && "text-primary")}>{n.title}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{n.message}</p>
                    <span className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleTimeString()}</span>
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-center text-primary cursor-pointer justify-center"
                onClick={() => navigate("/hospital/notifications")}
              >
                View all notifications
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-3 px-2">
                <Avatar className="h-9 w-9 border-2 border-primary/30">
                  <AvatarFallback className="bg-info/20 text-info font-medium">
                    <Building2 className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="hidden lg:flex flex-col items-start">
                  <span className="text-sm font-medium">Hospital Admin</span>
                  <span className="text-xs text-muted-foreground">Admin</span>
                </div>
                <ChevronDown className="h-4 w-4 hidden lg:block text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Hospital Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/hospital/settings")} className="cursor-pointer">
                <User className="mr-2 h-4 w-4" />
                Hospital Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/hospital/doctors")} className="cursor-pointer">
                Staff Management
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/hospital/settings")} className="cursor-pointer">
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer text-destructive">Log out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
