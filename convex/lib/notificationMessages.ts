export function formatAdminBookingSms(args: {
  customerName: string;
  appointmentDate: string;
  appointmentTime: string;
  photoCount: number;
  appointmentUrl: string;
}): string {
  const photoNotice =
    args.photoCount > 0
      ? ` Includes ${args.photoCount} before photo${args.photoCount === 1 ? "" : "s"}.`
      : "";
  return `River City MD: New booking received for ${args.customerName} on ${args.appointmentDate} at ${args.appointmentTime}.${photoNotice} ${args.appointmentUrl}`;
}
