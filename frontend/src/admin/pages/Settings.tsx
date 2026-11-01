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
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">System Settings</h1>
        <p className="text-gray-400 text-sm">Configure SAFE emergency monitoring system preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Settings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Notification Settings */}
          <Card className="bg-[#0F1825]/80 backdrop-blur-sm border-gray-800 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-[#3B82F6]/20 rounded-lg flex items-center justify-center">
                <Bell className="w-5 h-5 text-[#3B82F6]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Notification Settings</h2>
                <p className="text-xs text-gray-400">Configure alert preferences</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-white">Critical Incident Alerts</Label>
                  <p className="text-xs text-gray-400">Receive immediate notifications for critical emergencies</p>
                </div>
                <Switch defaultChecked />
              </div>

              <Separator className="bg-gray-800" />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-white">Response Updates</Label>
                  <p className="text-xs text-gray-400">Get notified when responders are assigned or arrive</p>
                </div>
                <Switch defaultChecked />
              </div>

              <Separator className="bg-gray-800" />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-white">Sound Alerts</Label>
                  <p className="text-xs text-gray-400">Play audio notification for new incidents</p>
                </div>
                <Switch defaultChecked />
              </div>

              <Separator className="bg-gray-800" />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-white">Email Notifications</Label>
                  <p className="text-xs text-gray-400">Send incident reports to email</p>
                </div>
                <Switch />
              </div>
            </div>
          </Card>

          {/* System Settings */}
          <Card className="bg-[#0F1825]/80 backdrop-blur-sm border-gray-800 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-[#22C55E]/20 rounded-lg flex items-center justify-center">
                <SettingsIcon className="w-5 h-5 text-[#22C55E]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">System Configuration</h2>
                <p className="text-xs text-gray-400">General system settings</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-white">Auto-Assign Responders</Label>
                  <p className="text-xs text-gray-400">Automatically assign available responders to new incidents</p>
                </div>
                <Switch />
              </div>

              <Separator className="bg-gray-800" />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-white">GPS Tracking</Label>
                  <p className="text-xs text-gray-400">Enable real-time location tracking</p>
                </div>
                <Switch defaultChecked />
              </div>

              <Separator className="bg-gray-800" />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-white">Voice Communication</Label>
                  <p className="text-xs text-gray-400">Enable voice calls between responders and control</p>
                </div>
                <Switch defaultChecked />
              </div>

              <Separator className="bg-gray-800" />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-white">Camera Integration</Label>
                  <p className="text-xs text-gray-400">Capture and verify incident photos</p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </Card>

          {/* Emergency Contacts */}
          <Card className="bg-[#0F1825]/80 backdrop-blur-sm border-gray-800 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-[#FF3B30]/20 rounded-lg flex items-center justify-center">
                <Radio className="w-5 h-5 text-[#FF3B30]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Emergency Contacts</h2>
                <p className="text-xs text-gray-400">Configure emergency response contacts</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-white">Clinic Main Line</Label>
                <Input
                  defaultValue="+63 88 856 1738"
                  className="bg-[#0B1220] border-gray-800 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white">Emergency Hotline</Label>
                <Input
                  defaultValue="911"
                  className="bg-[#0B1220] border-gray-800 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white">Admin Email</Label>
                <Input
                  defaultValue="clinic.admin@ustp.edu.ph"
                  className="bg-[#0B1220] border-gray-800 text-white"
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          {/* System Info */}
          <Card className="bg-[#0F1825]/80 backdrop-blur-sm border-gray-800 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-[#3B82F6]/20 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-[#3B82F6]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">System Info</h2>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-400">System Name</p>
                <p className="text-sm text-white font-medium mt-1">SAFE Medical Monitor</p>
              </div>
              <Separator className="bg-gray-800" />
              <div>
                <p className="text-xs text-gray-400">Version</p>
                <p className="text-sm text-white font-medium mt-1">v1.0.0</p>
              </div>
              <Separator className="bg-gray-800" />
              <div>
                <p className="text-xs text-gray-400">Organization</p>
                <p className="text-sm text-white font-medium mt-1">USTP CDO</p>
              </div>
              <Separator className="bg-gray-800" />
              <div>
                <p className="text-xs text-gray-400">Status</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-2 h-2 bg-[#22C55E] rounded-full animate-pulse"></div>
                  <p className="text-sm text-[#22C55E] font-medium">Online</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Quick Stats */}
          <Card className="bg-[#0F1825]/80 backdrop-blur-sm border-gray-800 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Quick Stats</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Active Users</span>
                <span className="text-sm text-white font-semibold">847</span>
              </div>
              <Separator className="bg-gray-800" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Medical Staff</span>
                <span className="text-sm text-white font-semibold">24</span>
              </div>
              <Separator className="bg-gray-800" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Response Rate</span>
                <span className="text-sm text-[#22C55E] font-semibold">98.5%</span>
              </div>
              <Separator className="bg-gray-800" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Avg Response</span>
                <span className="text-sm text-[#3B82F6] font-semibold">4.2 min</span>
              </div>
            </div>
          </Card>

          {/* Actions */}
          <Card className="bg-[#0F1825]/80 backdrop-blur-sm border-gray-800 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Actions</h2>
            <div className="space-y-3">
              <Button className="w-full bg-[#3B82F6] hover:bg-[#3B82F6]/80 text-white justify-start">
                <Shield className="w-4 h-4 mr-2" />
                Backup System Data
              </Button>
              <Button
                variant="outline"
                className="w-full border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800 justify-start"
              >
                <MapPin className="w-4 h-4 mr-2" />
                Update Campus Map
              </Button>
              <Button
                variant="outline"
                className="w-full border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800 justify-start"
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
        <Button className="bg-[#22C55E] hover:bg-[#22C55E]/80 text-white px-8">
          Save Changes
        </Button>
      </div>
    </div>
  );
}
