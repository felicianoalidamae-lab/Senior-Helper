export type UserRole = "owner" | "employee";
export type EmployeeStatus = "active" | "inactive";
export type LeaveType = "sick" | "emergency" | "vacation";
export type LeaveStatus = "pending" | "approved" | "declined" | "cancelled";
export type CurrentStatus = "working" | "on_break" | "clocked_out" | "not_in";

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  email: string;
  position: string | null;
  phone: string | null;
  start_date: string | null;
  status: EmployeeStatus;
  created_at: string;
}

export interface PayRate {
  id: string;
  employee_id: string;
  hourly_rate_cents: number;
  effective_from: string;
  created_at: string;
}

export interface TimeEntry {
  id: string;
  employee_id: string;
  work_date: string;
  clock_in: string;
  clock_out: string | null;
  source: "live" | "manual";
  edited_by: string | null;
  edited_at: string | null;
  edit_note: string | null;
  created_at: string;
}

export interface BreakRow {
  id: string;
  time_entry_id: string;
  break_start: string;
  break_end: string | null;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  type: LeaveType;
  start_date: string;
  end_date: string;
  reason: string;
  status: LeaveStatus;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
}

export interface Settings {
  id: true;
  business_name: string;
  timezone: string;
  pay_period_anchor: string;
  pay_period_days: number;
  shift_target_minutes: number;
  breaks_unpaid: boolean;
  work_days: number[];
  paid_leave_types: LeaveType[];
  week_start_day: number;
  weekly_ot_threshold_minutes: number;
  daily_ot_threshold_minutes: number | null;
  overtime_multiplier_pct: number;
}

export interface TodayBoardRow {
  employee_id: string;
  full_name: string;
  position: string | null;
  status: CurrentStatus | "on_leave";
  since: string | null;
}
