import { db } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { tbl_staff, tbl_library_visit } from '../db/schema/schema.js';

export interface LibraryVisit {
  id: number;
  userId: number;
  visitorName: string;
  visitorType: 'student' | 'faculty';
  purpose: string;
  timeIn: string;
  timeOut: string | null;
  createdAt: string;
}

export interface ScanStats {
  totalScans: number;
  studentsScanned: number;
  facultyScanned: number;
}

/**
 * Get recent library visits
 */
export async function getRecentVisits(limit: number = 20): Promise<LibraryVisit[]> {
  try {
    const visits = await db
      .select({
        id: tbl_library_visit.id,
        userId: tbl_library_visit.userId,
        visitorName: tbl_library_visit.visitorName,
        visitorType: tbl_library_visit.visitorType,
        purpose: tbl_library_visit.purpose,
        timeIn: tbl_library_visit.timeIn,
        timeOut: tbl_library_visit.timeOut,
        createdAt: tbl_library_visit.createdAt
      })
      .from(tbl_library_visit)
      .orderBy(tbl_library_visit.timeIn)
      .limit(limit);

    return visits.map(v => ({
      id: v.id,
      userId: v.userId || 0,
      visitorName: v.visitorName || '',
      visitorType: (v.visitorType as 'student' | 'faculty') || 'student',
      purpose: v.purpose || '',
      timeIn: v.timeIn.toISOString(),
      timeOut: v.timeOut?.toISOString() || null,
      createdAt: v.createdAt?.toISOString() || ''
    }));
  } catch (err) {
    console.error('Error fetching recent visits:', err);
    return [];
  }
}

/**
 * Calculate scan statistics
 */
export function calculateScanStats(visits: LibraryVisit[]): ScanStats {
  const studentScans = visits.filter((v) => v.visitorType === 'student').length;
  const facultyScans = visits.filter((v) => v.visitorType === 'faculty').length;

  return {
    totalScans: visits.length,
    studentsScanned: studentScans,
    facultyScanned: facultyScans
  };
}

/**
 * Get staff information by ID
 */
export async function getStaffInfo(staffId: number) {
  try {
    const staff = await db
      .select({
        id: tbl_staff.id,
        name: tbl_staff.name,
        email: tbl_staff.email,
        department: tbl_staff.department,
        position: tbl_staff.position
      })
      .from(tbl_staff)
      .where(eq(tbl_staff.id, staffId))
      .limit(1);

    return staff[0] || null;
  } catch (err) {
    console.error('Error fetching staff info:', err);
    return null;
  }
}

/**
 * Format visit for response
 */
export function formatVisitResponse(visit: LibraryVisit) {
  return {
    id: visit.id,
    memberType: visit.visitorType,
    memberName: visit.visitorName,
    purpose: visit.purpose,
    timestamp: visit.timeIn,
    timeIn: visit.timeIn,
    timeOut: visit.timeOut
  };
}
