import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"

export default function SettingsPage() {
  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div>
        <h2 className="text-3xl font-bold">Settings</h2>
        <p className="text-muted-foreground">Manage your business settings and preferences</p>
      </div>

      {/* Business Information */}
      <Card className="animate-fade-in-up">
        <CardHeader>
          <CardTitle>Business Information</CardTitle>
          <CardDescription>Update your business details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="business-name">Business Name</Label>
              <Input id="business-name" defaultValue="River City Mobile Detail" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" defaultValue="(501) 454-7140" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" defaultValue="Little Rock, AR" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Business Description</Label>
            <Textarea
              id="description"
              defaultValue="Professional mobile car detailing services in Central Arkansas."
              rows={3}
            />
          </div>
          <Button>Save Changes</Button>
        </CardContent>
      </Card>

      {/* Operating Hours */}
      <Card className="animate-fade-in-up" style={{ animationDelay: "100ms" }}>
        <CardHeader>
          <CardTitle>Operating Hours</CardTitle>
          <CardDescription>Set your business hours</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { day: "Monday", hours: "7:00 AM - 8:00 PM" },
            { day: "Tuesday", hours: "7:00 AM - 8:00 PM" },
            { day: "Wednesday", hours: "7:00 AM - 8:00 PM" },
            { day: "Thursday", hours: "7:00 AM - 8:00 PM" },
            { day: "Friday", hours: "7:00 AM - 8:00 PM" },
            { day: "Saturday", hours: "7:00 AM - 8:00 PM" },
            { day: "Sunday", hours: "Closed" },
          ].map((schedule, index) => (
            <div key={index} className="flex items-center justify-between">
              <span className="font-medium w-32">{schedule.day}</span>
              <Input className="max-w-xs" defaultValue={schedule.hours} />
            </div>
          ))}
          <Button>Update Hours</Button>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="animate-fade-in-up" style={{ animationDelay: "200ms" }}>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Manage your notification preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Email Notifications</div>
              <div className="text-sm text-muted-foreground">Receive booking confirmations via email</div>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">SMS Notifications</div>
              <div className="text-sm text-muted-foreground">Get text alerts for new bookings</div>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Marketing Emails</div>
              <div className="text-sm text-muted-foreground">Receive tips and updates</div>
            </div>
            <Switch />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
