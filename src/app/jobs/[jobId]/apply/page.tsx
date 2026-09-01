import { redirect } from 'next/navigation'

export default async function LegacyApplyPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params
  redirect(`/careers/${jobId}`)
}
