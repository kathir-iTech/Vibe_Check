export default async function ReportPage({ params }: { params: Promise<any> }) {
  const { id } = await params;
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <h1>Report {id}</h1>
      <p>Shareable verdict report.</p>
    </main>
  );
}
