const DJANGO_API = import.meta.env.VITE_DJANGO_API_URL || 'http://localhost:8000';

export async function loginWithDjango(credentials: { username: string; password: string }) {
    const response = await fetch(`${DJANGO_API}/api/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Django authentication failed');
    }
    return data; // Returns django token / user profile
}

export async function createClinicStaff(staffData: {
    username: string;
    email: string;
    name: string;
    password: string;
    department: string;          // 👈 Added
    contact_number: string;      // 👈 Added
    availability_status?: string; // 👈 Added
    role?: string;               // 👈 Added
}, adminAccessToken: string) {
    const response = await fetch(`${DJANGO_API}/api/auth/admin/create-staff/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminAccessToken}`
        },
        body: JSON.stringify(staffData),
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Failed to create clinic staff member.');
    }
    return data;
}