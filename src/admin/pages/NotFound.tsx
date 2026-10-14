import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "../components/bits";

export default function AdminNotFound() {
  return (
    <EmptyState icon={Compass} text="That admin page doesn't exist." action={<Button asChild variant="outline" size="sm"><Link to="/admin">Back to overview</Link></Button>} />
  );
}
