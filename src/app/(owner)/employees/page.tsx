import { listEmployees } from "@/lib/data/employees";
import { AddEmployeeDialog } from "./add-employee-dialog";
import { EmployeesTable } from "./employees-table";

export default async function EmployeesPage() {
  const employees = await listEmployees();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink">Employees</h1>
        <AddEmployeeDialog />
      </div>
      <div className="card mt-4">
        {employees.length === 0 ? (
          <p className="text-muted">No employees yet. Add your first one above.</p>
        ) : (
          <EmployeesTable employees={employees} />
        )}
      </div>
    </div>
  );
}
