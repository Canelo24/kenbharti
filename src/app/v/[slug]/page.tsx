import VoterClient from "./VoterClient";

export default function VoterPage({ params }: { params: { slug: string } }) {
  return <VoterClient slug={params.slug} />;
}
