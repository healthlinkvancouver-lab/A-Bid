import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Shield, FileText, CheckCircle2 } from "lucide-react";

// In-memory consent flag (persists within session, resets on page reload)
let consentGiven = false;

interface ConsentDialogProps {
  onConsent?: () => void;
}

export function RatingConsentDialog({ onConsent }: ConsentDialogProps) {
  const [open, setOpen] = useState(false);
  const [agreed1, setAgreed1] = useState(false);
  const [agreed2, setAgreed2] = useState(false);
  const [agreed3, setAgreed3] = useState(false);

  useEffect(() => {
    if (!consentGiven) {
      setOpen(true);
    }
  }, []);

  const handleAccept = () => {
    consentGiven = true;
    setOpen(false);
    onConsent?.();
  };

  const allAgreed = agreed1 && agreed2 && agreed3;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg" data-testid="dialog-consent">
        <DialogHeader>
          <div className="mb-2 flex items-center gap-2">
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Shield className="h-4 w-4" />
            </div>
            <DialogTitle className="text-lg" style={{ fontFamily: "var(--font-display)" }}>
              Your Privacy & Ratings Consent
            </DialogTitle>
          </div>
          <DialogDescription className="text-left">
            ABid's rating system is built to comply with Canadian privacy law (PIPEDA/PIPA).
            Please review and accept the following before using ratings:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <ConsentItem
            checked={agreed1}
            onChange={setAgreed1}
            icon={FileText}
            title="Consent to Be Rated"
            description="I understand that hosts may rate my stay (cleanliness, communication, respect) and that these ratings will be visible to other hosts on ABid for booking screening purposes."
            testId="checkbox-consent-1"
          />
          <ConsentItem
            checked={agreed2}
            onChange={setAgreed2}
            icon={Shield}
            title="Right to Access & Correct"
            description="I understand I can view all ratings about me, request corrections for inaccurate reviews, and dispute ratings through ABid's resolution process."
            testId="checkbox-consent-2"
          />
          <ConsentItem
            checked={agreed3}
            onChange={setAgreed3}
            icon={CheckCircle2}
            title="Accurate & Factual Reviews"
            description="I agree to write only truthful, factual reviews. I understand that defamatory or false statements may be removed and could carry legal liability under Canadian law."
            testId="checkbox-consent-3"
          />
        </div>

        <div className="rounded-lg border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
          <p>Ratings expire after 24 months. You may withdraw consent and request data deletion at any time by contacting ABid support. See our full Privacy Policy for details.</p>
        </div>

        <DialogFooter>
          <Button
            onClick={handleAccept}
            disabled={!allAgreed}
            data-testid="button-accept-consent"
          >
            I Agree — Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConsentItem({
  checked,
  onChange,
  icon: Icon,
  title,
  description,
  testId,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  testId: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 hover:bg-muted/50" data-testid={testId}>
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        className="mt-0.5"
      />
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">{title}</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </label>
  );
}
