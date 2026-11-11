import { Settings as SettingsIcon, Bell, Shield, Users, Radio, MapPin } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Switch } from '../components/ui/switch';
import { Separator } from '../components/ui/separator';

export function Settings() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white/40 backdrop-blur-sm p-5 rounded-2xl border border-amber-200/50 shadow-sm">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 mb-1">System Settings</h1>
          <p className="text-slate-700 text-sm font-semibold">Configure SAFE emergency monitoring system preferences</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Settings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Notification Settings */}
          <Card className="bg-white border-amber-200/60 shadow-md p-6 rounded-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <Bell className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Notification Settings</h2>
                <p className="text-xs text-slate-500 font-medium">Configure alert preferences</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-slate-900 font-bold">Critical Incident Alerts</Label>
                  <p className="text-xs text-slate-500 font-medium">Receive immediate notifications for critical emergencies</p>
                </div>
                <Switch defaultChecked className="data-[state=checked]:bg-blue-600" />
              </div>

              <Separator className="bg-slate-100" />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-slate-900 font-bold">Response Updates</Label>
                  <p className="text-xs text-slate-500 font-medium">Get notified when responders are assigned or arrive</p>
                </div>
                <Switch defaultChecked className="data-[state=checked]:bg-blue-600" />
              </div>

              <Separator className="bg-slate-100" />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-slate-900 font-bold">Sound Alerts</Label>
                  <p className="text-xs text-slate-500 font-medium">Play audio notification for new incidents</p>
                </div>
                <Switch defaultChecked className="data-[state=checked]:bg-blue-600" />
              </div>

              <Separator className="bg-slate-100" />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-slate-900 font-bold">Email Notifications</Label>
                  <p className="text-xs text-slate-500 font-medium">Send incident reports to email</p>
                </div>
                <Switch className="data-[state=checked]:bg-blue-600" />
              </div>
            </div>
          </Card>

          {/* System Settings */}
          <Card className="bg-white border-amber-200/60 shadow-md p-6 rounded-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                <SettingsIcon className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">System Configuration</h2>
                <p className="text-xs text-slate-500 font-medium">General system settings</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-slate-900 font-bold">Auto-Assign Responders</Label>
                  <p className="text-xs text-slate-500 font-medium">Automatically assign available responders to new incidents</p>
                </div>
                <Switch className="data-[state=checked]:bg-blue-600" />
              </div>

              <Separator className="bg-slate-100" />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-slate-900 font-bold">GPS Tracking</Label>
                  <p className="text-xs text-slate-500 font-medium">Enable real-time location tracking</p>
                </div>
                <Switch defaultChecked className="data-[state=checked]:bg-blue-600" />
              </div>

              <Separator className="bg-slate-100" />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-slate-900 font-bold">Voice Communication</Label>
                  <p className="text-xs text-slate-500 font-medium">Enable voice calls between responders and control</p>
                </div>
                <Switch defaultChecked className="data-[state=checked]:bg-blue-600" />
              </div>

              <Separator className="bg-slate-100" />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-slate-900 font-bold">Camera Integration</Label>
                  <p className="text-xs text-slate-500 font-medium">Capture and verify incident photos</p>
                </div>
                <Switch defaultChecked className="data-[state=checked]:bg-blue-600" />
              </div>
            </div>
          </Card>

          {/* Emergency Contacts */}
          <Card className="bg-white border-amber-200/60 shadow-md p-6 rounded-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                <Radio className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Emergency Contacts</h2>
                <p className="text-xs text-slate-500 font-medium">Configure emergency response contacts</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-900 font-bold">Clinic Main Line</Label>
                <Input
                  defaultValue="+63 88 856 1738"
                  className="bg-slate-50 border-slate-200 text-slate-900 font-medium rounded-xl focus:bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-900 font-bold">Emergency Hotline</Label>
                <Input
                  defaultValue="911"
                  className="bg-slate-50 border-slate-200 text-slate-900 font-medium rounded-xl focus:bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-900 font-bold">Admin Email</Label>
                <Input
                  defaultValue="clinic.admin@ustp.edu.ph"
                  className="bg-slate-50 border-slate-200 text-slate-900 font-medium rounded-xl focus:bg-white"
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          {/* System Info */}
          <Card className="bg-white border-amber-200/60 shadow-md p-6 rounded-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <Shield className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">System Info</h2>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">System Name</p>
                <p className="text-sm text-slate-900 font-bold mt-1">SAFE Medical Monitor</p>
              </div>
              <Separator className="bg-slate-100" />
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Version</p>
                <p className="text-sm text-slate-900 font-bold mt-1">v1.0.0</p>
              </div>
              <Separator className="bg-slate-100" />
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Organization</p>
                <p className="text-sm text-slate-900 font-bold mt-1">USTP CDO</p>
              </div>
              <Separator className="bg-slate-100" />
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Status</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-2 h-2 bg-emerald-600 rounded-full animate-pulse"></div>
                  <p className="text-sm text-emerald-700 font-bold">Online</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Quick Stats */}
          <Card className="bg-white border-amber-200/60 shadow-md p-6 rounded-2xl">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Quick Stats</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 font-medium">Active Users</span>
                <span className="text-sm text-slate-900 font-extrabold">847</span>
              </div>
              <Separator className="bg-slate-100" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 font-medium">Medical Staff</span>
                <span className="text-sm text-slate-900 font-extrabold">24</span>
              </div>
              <Separator className="bg-slate-100" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 font-medium">Response Rate</span>
                <span className="text-sm text-emerald-700 font-extrabold">98.5%</span>
              </div>
              <Separator className="bg-slate-100" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 font-medium">Avg Response</span>
                <span className="text-sm text-blue-600 font-extrabold">4.2 min</span>
              </div>
            </div>
          </Card>

          {/* Actions */}
          <Card className="bg-white border-amber-200/60 shadow-md p-6 rounded-2xl">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Actions</h2>
            <div className="space-y-3">
              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white justify-start font-bold rounded-xl shadow-sm">
                <Shield className="w-4 h-4 mr-2" />
                Backup System Data
              </Button>
              <Button
                variant="outline"
                className="w-full bg-slate-100 border-slate-200 text-slate-900 hover:bg-slate-200 justify-start font-bold rounded-xl shadow-sm"
              >
                <MapPin className="w-4 h-4 mr-2" />
                Update Campus Map
              </Button>
              <Button
                variant="outline"
                className="w-full bg-slate-100 border-slate-200 text-slate-900 hover:bg-slate-200 justify-start font-bold rounded-xl shadow-sm"
              >
                <Users className="w-4 h-4 mr-2" />
                Manage Permissions
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 font-bold rounded-xl shadow-md">
          Save Changes
        </Button>
      </div>
    </div>
  );
}