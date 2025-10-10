"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AppointmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AppointmentModal({
  open,
  onOpenChange,
}: AppointmentModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            Schedule Your Detailing
          </DialogTitle>
          <DialogDescription>
            Choose a convenient time for your mobile car detailing service
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          {/* Cal.com embed */}
          <iframe
            src="https://cal.com/dustin-grimes-gursad/interior-detail-medium-vehicle"
            width="100%"
            height="600"
            frameBorder="0"
            className="rounded-lg"
            title="Book an appointment"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
