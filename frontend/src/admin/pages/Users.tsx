import { useState } from 'react';
import { UsersRound, Search, UserPlus, Trash2, X, RefreshCw } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { DataNotice } from '../DataNotice';
import { useAdminData } from '../useAdminData';
import { createUser, deleteUser } from '../api';

export function Users() {
  const { users, responders, loading, error } = useAdminData();
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state for adding a new user
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [course, setCourse] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [userType, setUserType] = useState('user');

  // Combine users and responders data so clinic staff/responders automatically appear here
  const combinedUsers = [
    ...users,
    ...responders.map((r: any) => ({
      user_id: `resp-${r.responders_id || r.id}`,
      name: r.name,
      username: r.name ? r.name.toLowerCase().replace(/[^a-z0-9_]/g, '_') : 'staff',
      user_type: r.user_type || 'clinic_staff',
      course: r.department || 'Clinic Staff',
      status: r.availability_status || 'Active',
      isResponder: true,
    }))
  ];

  const matchingUsers = combinedUsers.filter((user: any) => {
    const userName = user.name || '';
    const userHandle = user.username || '';
    const role = user.user_type || user.role || '';
    const dept = user.course || user.building || '';
    const query = search.toLowerCase();

    return (
      userName.toLowerCase().includes(query) ||
      userHandle.toLowerCase().includes(query) ||
      role.toLowerCase().includes(query) ||
      dept.toLowerCase().includes(query)
    );
  });

  const countRole = (roleKey: string) =>
    combinedUsers.filter((user: any) => (user.user_type || user.role || '').toLowerCase() === roleKey.toLowerCase()).length;

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      alert('Please enter a name.');
      return;
    }
    if (!password) {
      alert('Please enter a password.');
      return;
    }
    if (password.length < 6) {
      alert('Password must be at least 6 characters long.');
      return;
    }

    setSubmitting(true);
    try {
      await createUser({
        name,
        username: username || name.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
        password,
        course,
        phone_number: phoneNumber,
        user_type: userType,
      } as any); // Cast as any to bypass strict type check for password
      
      setIsModalOpen(false);
      setName('');
      setUsername('');
      setPassword('');
      setCourse('');
      setPhoneNumber('');
      setUserType('user');
      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create user.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (userId: string | number) => {
    if (String(userId).startsWith('resp-')) {
      alert('Responders/Staff can be managed under the Responders tab.');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this user?')) return;

    try {
      await deleteUser(userId);
      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete user.');
    }
  };

  return (
    <div className="space-y-6">
      <DataNotice loading={loading} error={error} />
     
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">User Management</h1>
          <p className="text-gray-400 text-sm">Add, manage, and remove users and staff</p>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          className="bg-[#3B82F6] hover:bg-blue-600 text-white flex items-center gap-2 w-fit shadow-md text-xs"
        >
          <UserPlus className="w-4 h-4" />
          Add New User
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-[#0F1825]/80 backdrop-blur-sm border-gray-800 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Total Directory</p>
              <p className="text-3xl font-bold text-white">{combinedUsers.length}</p>
            </div>
            <UsersRound className="w-8 h-8 text-gray-400" />
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-[#3B82F6]/20 to-[#3B82F6]/5 border-[#3B82F6]/30 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Students / Users</p>
              <p className="text-3xl font-bold text-white">{countRole('user')}</p>
            </div>
            <UsersRound className="w-8 h-8 text-[#3B82F6]" />
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-[#22C55E]/20 to-[#22C55E]/5 border-[#22C55E]/30 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Clinic Staff</p>
              <p className="text-3xl font-bold text-white">{countRole('clinic_staff') + countRole('responder')}</p>
            </div>
            <UsersRound className="w-8 h-8 text-[#22C55E]" />
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-[#FACC15]/20 to-[#FACC15]/5 border-[#FACC15]/30 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Administrators</p>
              <p className="text-3xl font-bold text-white">{countRole('admin')}</p>
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
            className="pl-10 bg-[#0B1220] border-gray-800 text-white placeholder:text-gray-500 text-xs"
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
                <TableHead className="text-gray-400">Course / Department</TableHead>
                <TableHead className="text-gray-400">Status</TableHead>
                <TableHead className="text-gray-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matchingUsers.map((user: any) => {
                const name = user.name || 'Unknown User';
                const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'U';
                const userId = user.user_id || user.id;
                const role = user.user_type || user.role || 'user';
                const course = user.course || user.building || 'N/A';
                const status = user.status || 'Active';

                return (
                  <TableRow key={userId} className="border-gray-800 hover:bg-[#0B1220]/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10 border-2 border-gray-700">
                          <AvatarFallback className="bg-gradient-to-br from-[#3B82F6] to-[#FF3B30] text-white text-xs">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-white text-sm">{name}</p>
                          <p className="text-xs text-gray-500 font-mono">ID: {userId}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          role.toLowerCase() === 'clinic_staff' || role.toLowerCase() === 'responder'
                            ? 'bg-[#22C55E]/20 text-[#22C55E] border-[#22C55E]/50'
                            : role.toLowerCase() === 'admin'
                            ? 'bg-[#3B82F6]/20 text-[#3B82F6] border-[#3B82F6]/50'
                            : 'bg-gray-500/20 text-gray-400 border-gray-500/50'
                        }
                      >
                        {role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-300 font-mono text-xs">{user.username || '—'}</TableCell>
                    <TableCell className="text-gray-300 text-xs">{course}</TableCell>
                    <TableCell>
                      <Badge className={status.toLowerCase() === 'active' || status.toLowerCase() === 'available'
                        ? 'bg-[#22C55E]/20 text-[#22C55E] border-[#22C55E]/50'
                        : 'bg-gray-500/20 text-gray-400 border-gray-500/50'}>
                        {status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {!user.isResponder ? (
                        <button
                          onClick={() => handleDelete(userId)}
                          className="text-red-400 hover:text-red-300 p-1.5 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors cursor-pointer"
                          title="Delete User"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="text-gray-500 text-xs">Staff record</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {!loading && !error && matchingUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-gray-400">
                    No matching users found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Add User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <Card className="bg-[#0F1825] border-gray-800 w-full max-w-md p-6 space-y-6 relative shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-800 pb-4">
              <h2 className="text-lg font-bold text-white">Add New User</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1" htmlFor="full-name-input">Full Name *</label>
                <input
                  id="full-name-input"
                  name="fullName"
                  type="text"
                  required
                  placeholder="e.g., Juan Dela Cruz"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#0B1220] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3B82F6]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1" htmlFor="username-input">Username</label>
                <input
                  id="username-input"
                  name="username"
                  type="text"
                  placeholder="e.g., juandelacruz (optional)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-[#0B1220] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3B82F6]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1" htmlFor="password-input">Password *</label>
                <input
                  id="password-input"
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  placeholder="Min. 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#0B1220] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3B82F6]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1" htmlFor="course-input">Course / Department</label>
                <input
                  id="course-input"
                  name="course"
                  type="text"
                  placeholder="e.g., BS Information Technology"
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  className="w-full bg-[#0B1220] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3B82F6]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1" htmlFor="phone-input">Phone Number</label>
                <input
                  id="phone-input"
                  name="phoneNumber"
                  type="text"
                  placeholder="e.g., 09123456789"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full bg-[#0B1220] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3B82F6]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1" htmlFor="role-select">Role Type</label>
                <select
                  id="role-select"
                  name="userType"
                  value={userType}
                  onChange={(e) => setUserType(e.target.value)}
                  className="w-full bg-[#0B1220] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3B82F6]"
                >
                  <option value="user">User / Student</option>
                  <option value="clinic_staff">Clinic Staff</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  className="border-gray-700 text-gray-300 hover:bg-gray-800 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#3B82F6] hover:bg-blue-600 text-white text-xs flex items-center gap-2"
                >
                  {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Save User
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}