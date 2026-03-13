import { ReferenceViewer, referenceMetadata } from "@/components/reference/ReferenceViewer";

export const metadata = referenceMetadata("Invest");

export default function InvestReferencePage() {
  return (
    <ReferenceViewer
      title="Invest"
      mode="html"
      src="/reference-pages/invest/Origin%20Financial.html"
    />
  );
}
