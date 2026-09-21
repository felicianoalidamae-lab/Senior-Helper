export default function EmployeeDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="card">
      <h1 className="text-xl font-semibold text-ink">Employee</h1>
      <p className="mt-1 text-muted">Details for {params.id} coming in a later milestone.</p>
    </div>
  );
}
