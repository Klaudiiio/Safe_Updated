import { useState } from 'react';
import { UsersRound, Search } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { DataNotice } from '../DataNotice';
import { useAdminData } from '../useAdminData';

export function Users() {
  const { users, loading, error } = useAdminData();
  const [search, setSearch] = useState('');
  const matchingUsers = users.filter((user) => (
    `${user.name} ${user.username} ${user.role} ${user.building}`.toLowerCase().includes(search.toLowerCase())
  ));
  const countRole = (role: string) => users.filter((user) => user.role.toLowerCase() === role).length;

  return (
    <div className="space-y-6">
      <DataNotice loading={loading} error={error} />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">User Management</h1>
          <p className="text-gray-400 text-sm">Read-only user directory synchronized from Supabase</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-[#0F1825]/80 backdrop-blur-sm border-gray-800 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Total Users</p>
              <p className="text-3xl font-bold text-white">{users.length}</p>
            </div>
            <UsersRound className="w-8 h-8 text-gray-400" />
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-[#3B82F6]/20 to-[#3B82F6]/5 border-[#3B82F6]/30 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Users</p>
              <p className="text-3xl font-bold text-white">
                {countRole('user')}
              </p>
            </div>
            <UsersRound className="w-8 h-8 text-[#3B82F6]" />
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-[#22C55E]/20 to-[#22C55E]/5 border-[#22C55E]/30 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Clinic Staff</p>
              <p className="text-3xl font-bold text-white">
                {countRole('clinic_staff')}
              </p>
            </div>
            <UsersRound className="w-8 h-8 text-[#22C55E]" />
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-[#FACC15]/20 to-[#FACC15]/5 border-[#FACC15]/30 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Administrators</p>
              <p className="text-3xl font-bold text-white">
                {countRole('admin')}
              </p>
            </div>
            <UsersRound className="w-8 h-8 text-[#FACC15]" />
          </div>
        </Card>
      </div>

      {/* Search */}
      <Card className="bg-[#0F1825]/80 backdrop-blur-sm border-gray-800 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search users by name, username, course, or role..."
            className="pl-10 bg-[#0B1220] border-gray-800 text-white placeholder:text-gray-500"
          />
        </div>
      </Card>

      {/* Users Table */}
      <Card className="bg-[#0F1825]/80 backdrop-blur-sm border-gray-800">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-800 hover:bg-transparent">
                <TableHead className="text-gray-400">User</TableHead>
                <TableHead className="text-gray-400">Role</TableHead>
                <TableHead className="text-gray-400">Username</TableHead>
                <TableHead className="text-gray-400">Course</TableHead>
                <TableHead className="text-gray-400">Status</TableHead>
                <TableHead className="text-gray-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matchingUsers.map((user) => {
                const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase();
                return (
                  <TableRow key={user.id} className="border-gray-800 hover:bg-[#0B1220]/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10 border-2 border-gray-700">
                          <AvatarFallback className="bg-gradient-to-br from-[#3B82F6] to-[#FF3B30] text-white text-xs">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-white">{user.name}</p>
                          <p className="text-xs text-gray-500">{user.id}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          user.role.toLowerCase() === 'clinic_staff'
                            ? 'bg-[#22C55E]/20 text-[#22C55E] border-[#22C55E]/50'
                            : user.role.toLowerCase() === 'admin'
                            ? 'bg-[#3B82F6]/20 text-[#3B82F6] border-[#3B82F6]/50'
                            : 'bg-gray-500/20 text-gray-400 border-gray-500/50'
                        }
                      >
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-300">{user.username}</TableCell>
                    <TableCell className="text-gray-300">{user.building}</TableCell>
                    <TableCell>
                      <Badge className={user.status.toLowerCase() === 'active'
                        ? 'bg-[#22C55E]/20 text-[#22C55E] border-[#22C55E]/50'
                        : 'bg-gray-500/20 text-gray-400 border-gray-500/50'}>
                        {user.status}
                      </Badge>
                    </TableCell>
                      <TableCell className="text-gray-500">Read only</TableCell>
                    </TableRow>
                );
                })}
                {!loading && !error && matchingUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-gray-400">
                      No matching users.
                    </TableCell>
                  </TableRow>
                )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
