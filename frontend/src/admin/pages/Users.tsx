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
  const { users, loading, error } = useAdminData();
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

  // Filter ONLY standard users (exclude clinic staff, responders, and admins from this table)
  const standardUsers = users.filter((u: any) => {
    const role = (u.user_type || u.role || 'user').toLowerCase();
    return role === 'user' || role === 'student' || (!['admin', 'clinic_staff', 'responder', 'staff'].includes(role));
  });

  const matchingUsers = standardUsers.filter((user: any) => {
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
      } as any);
     
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white/40 backdrop-blur-sm p-5 rounded-2xl border border-sky-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 mb-1">User Management</h1>
          <p className="text-slate-700 text-sm font-semibold">Add, manage, and remove standard platform users</p>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 w-fit shadow-md text-xs font-bold rounded-xl"
        >
          <UserPlus className="w-4 h-4" />
          Add New User
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white border-sky-100/60 shadow-md p-5 rounded-2xl">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Total Users</p>
              <p className="text-3xl font-extrabold text-slate-900">{standardUsers.length}</p>
            </div>
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
              <UsersRound className="w-6 h-6 text-slate-600" />
            </div>
          </div>
        </Card>

        <Card className="bg-white border-blue-200 shadow-md p-5 rounded-2xl">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-blue-700 text-xs font-semibold uppercase tracking-wider mb-1">Students / Standard Users</p>
              <p className="text-3xl font-extrabold text-slate-900">{standardUsers.length}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <UsersRound className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="bg-white border-emerald-200 shadow-md p-5 rounded-2xl">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-emerald-700 text-xs font-semibold uppercase tracking-wider mb-1">Active Status</p>
              <p className="text-3xl font-extrabold text-slate-900">
                {standardUsers.filter((u: any) => (u.status || 'active').toLowerCase() === 'active').length}
              </p>
            </div>
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
              <UsersRound className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Search */}
      <Card className="bg-white border-sky-100/60 shadow-md p-4 rounded-2xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search users by name, username, course..."
            className="pl-10 bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 text-xs rounded-xl font-medium focus:bg-white"
          />
        </div>
      </Card>

      {/* Users Table */}
      <Card className="bg-white border-sky-100/60 shadow-md rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-100 hover:bg-transparent bg-slate-50">
                <TableHead className="text-slate-700 font-bold">User</TableHead>
                <TableHead className="text-slate-700 font-bold">Role</TableHead>
                <TableHead className="text-slate-700 font-bold">Username</TableHead>
                <TableHead className="text-slate-700 font-bold">Course / Department</TableHead>
                <TableHead className="text-slate-700 font-bold">Status</TableHead>
                <TableHead className="text-slate-700 font-bold">Actions</TableHead>
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
                  <TableRow key={userId} className="border-slate-100 hover:bg-slate-50/80">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10 border border-slate-200">
                          <AvatarFallback className="bg-blue-600 text-white text-xs font-bold">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{name}</p>
                          <p className="text-xs text-slate-500 font-mono">ID: {userId}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-slate-100 text-slate-700 border-slate-200 font-semibold">
                        {role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-700 font-mono text-xs font-semibold">{user.username || '—'}</TableCell>
                    <TableCell className="text-slate-700 text-xs font-medium">{course}</TableCell>
                    <TableCell>
                      <Badge className={status.toLowerCase() === 'active' || status.toLowerCase() === 'available'
                        ? 'bg-emerald-100 text-emerald-700 border-emerald-200 font-bold'
                        : 'bg-slate-100 text-slate-600 border-slate-200 font-bold'}>
                        {status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => handleDelete(userId)}
                        className="text-red-600 hover:text-red-700 p-1.5 bg-red-50 hover:bg-red-100 rounded-xl transition-colors cursor-pointer"
                        title="Delete User"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!loading && !error && matchingUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-slate-500 font-medium">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="bg-white border-sky-100 text-slate-900 w-full max-w-md p-6 space-y-6 relative shadow-2xl rounded-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-slate-900">Add New User</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="full-name-input">Full Name *</label>
                <input
                  id="full-name-input"
                  name="fullName"
                  type="text"
                  required
                  placeholder="e.g., Juan Dela Cruz"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 font-medium focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="username-input">Username</label>
                <input
                  id="username-input"
                  name="username"
                  type="text"
                  placeholder="e.g., juandelacruz (optional)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 font-medium focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="password-input">Password *</label>
                <input
                  id="password-input"
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  placeholder="Min. 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 font-medium focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="course-input">Course / Department</label>
                <input
                  id="course-input"
                  name="course"
                  type="text"
                  placeholder="e.g., BS Information Technology"
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 font-medium focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="phone-input">Phone Number</label>
                <input
                  id="phone-input"
                  name="phoneNumber"
                  type="text"
                  placeholder="e.g., 09123456789"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 font-medium focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="role-select">Role Type</label>
                <select
                  id="role-select"
                  name="userType"
                  value={userType}
                  onChange={(e) => setUserType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 font-medium focus:outline-none focus:border-blue-600 cursor-pointer"
                >
                  <option value="user">User / Student</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  className="border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 rounded-xl shadow-sm"
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