import { useState } from 'react'
import {
  Check,
  Copy,
  Mic,
  RotateCcw,
  Smartphone,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  getShortcutApiUrl,
  getSupabaseAnonKey,
  useShortcutToken,
} from '@/hooks/useShortcutToken'

type CopyField = 'token' | 'url' | 'anon' | 'steps' | null

interface SiriShortcutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SiriShortcutDialog({ open, onOpenChange }: SiriShortcutDialogProps) {
  const { hasToken, loading, createToken, revokeToken } = useShortcutToken()
  const [token, setToken] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [revoking, setRevoking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<CopyField>(null)
  const [step, setStep] = useState<1 | 2 | 3>(1)

  const apiUrl = getShortcutApiUrl()
  const anonKey = getSupabaseAnonKey()
  const displayToken = token ?? (hasToken ? '••••••••••••••••' : null)

  const copyText = async (text: string, field: CopyField) => {
    await navigator.clipboard.writeText(text)
    setCopied(field)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    const result = await createToken()
    setGenerating(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setToken(result.token)
    setStep(2)
  }

  const handleRevoke = async () => {
    setRevoking(true)
    setError(null)
    const result = await revokeToken()
    setRevoking(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setToken(null)
    setStep(1)
  }

  const setupStepsText = buildSetupStepsText({
    apiUrl,
    anonKey,
    token: token ?? '<paste your token from step 1>',
  })

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setStep(hasToken || token ? 2 : 1)
      setError(null)
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5 text-primary" />
            Home Organizer with Siri
          </DialogTitle>
          <DialogDescription>
            One shortcut understands what you mean — add or remove items from your shopping list,
            pantry, or supply closet.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {!apiUrl || !anonKey ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
            <p>Supabase is not configured. Add your project URL and anon key to <code className="text-xs">.env</code> first.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Step indicator */}
            <div className="flex gap-2 text-xs">
              {([1, 2, 3] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setStep(n)}
                  className={`flex-1 rounded-full py-1.5 font-medium transition-colors ${
                    step === n
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  Step {n}
                </button>
              ))}
            </div>

            {step === 1 && (
              <section className="space-y-4">
                <div>
                  <h3 className="font-medium mb-1">1. Generate your personal token</h3>
                  <p className="text-sm text-muted-foreground">
                    This token links Siri to your account and household. Keep it secret — anyone
                    with it can change your lists and inventory.
                  </p>
                </div>

                {loading ? (
                  <p className="text-sm text-muted-foreground">Checking token…</p>
                ) : token ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Your new token (shown once):</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 break-all rounded-lg bg-muted px-3 py-2 text-xs font-mono">
                        {token}
                      </code>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => void copyText(token, 'token')}
                        title="Copy token"
                      >
                        {copied === 'token' ? (
                          <Check className="h-4 w-4 text-primary" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Copy this now. If you leave without copying, you&apos;ll need to regenerate.
                    </p>
                  </div>
                ) : hasToken ? (
                  <div className="rounded-lg border bg-muted/40 px-3 py-3 text-sm">
                    <p className="font-medium">Token active</p>
                    <p className="text-muted-foreground text-xs mt-1">
                      You already have a token set up. Regenerate only if it was compromised or
                      you need a new copy.
                    </p>
                  </div>
                ) : null}

                <div className="flex flex-col gap-2">
                  <Button onClick={() => void handleGenerate()} disabled={generating || !apiUrl}>
                    <Smartphone className="h-4 w-4" />
                    {hasToken && !token ? 'Regenerate token' : 'Generate token'}
                  </Button>
                  {hasToken && (
                    <Button
                      variant="outline"
                      onClick={() => void handleRevoke()}
                      disabled={revoking}
                    >
                      <RotateCcw className="h-4 w-4" />
                      Revoke token
                    </Button>
                  )}
                </div>

                {(token || hasToken) && (
                  <Button className="w-full" onClick={() => setStep(2)}>
                    Continue to build shortcut →
                  </Button>
                )}
              </section>
            )}

            {step === 2 && (
              <section className="space-y-4">
                <div>
                  <h3 className="font-medium mb-1">2. Build the shortcut in the Shortcuts app</h3>
                  <p className="text-sm text-muted-foreground">
                    Open the Shortcuts app on your iPhone and create a new shortcut with these
                    actions in order:
                  </p>
                </div>

                <a
                  href="shortcuts://"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  Open Shortcuts app
                  <ExternalLink className="h-3 w-3" />
                </a>

                <ol className="list-decimal list-inside space-y-3 text-sm">
                  <li className="space-y-1">
                    <strong>Ask for Input</strong>
                    <p className="text-muted-foreground text-xs ml-5">
                      Prompt: &ldquo;What do you want to do?&rdquo; — or skip this if you use
                      Siri with a phrase like &ldquo;Update home organizer&rdquo; (use Shortcut
                      Input as the text).
                    </p>
                  </li>
                  <li className="space-y-1">
                    <strong>Get Contents of URL</strong>
                    <ul className="text-xs text-muted-foreground ml-5 mt-1 space-y-1 list-disc list-inside">
                      <li>
                        URL:{' '}
                        <button
                          type="button"
                          className="text-primary underline"
                          onClick={() => void copyText(apiUrl, 'url')}
                        >
                          {copied === 'url' ? 'Copied!' : 'copy API URL'}
                        </button>
                      </li>
                      <li>Method: <strong>POST</strong></li>
                      <li>
                        Headers — add two rows:
                        <div className="mt-1 rounded bg-muted px-2 py-1.5 font-mono text-[11px] space-y-0.5">
                          <div>Content-Type: application/json</div>
                          <div>
                            apikey:{' '}
                            <button
                              type="button"
                              className="text-primary underline font-sans"
                              onClick={() => void copyText(anonKey, 'anon')}
                            >
                              {copied === 'anon' ? 'copied' : 'copy anon key'}
                            </button>
                          </div>
                          <div>X-Shortcut-Token: your token from step 1</div>
                        </div>
                      </li>
                      <li>
                        Request Body: <strong>JSON</strong>
                        <div className="mt-1 rounded bg-muted px-2 py-1.5 font-mono text-[11px]">
                          {`{ "text": "Provided Input" }`}
                        </div>
                        <p className="mt-1">
                          Replace &ldquo;Provided Input&rdquo; with the magic variable from Ask
                          for Input, or <strong>Shortcut Input</strong> if using a Siri phrase.
                        </p>
                      </li>
                    </ul>
                  </li>
                  <li className="space-y-1">
                    <strong>Get Dictionary Value</strong>
                    <p className="text-muted-foreground text-xs ml-5">
                      Key: <code className="text-xs">message</code> — from the URL response.
                    </p>
                  </li>
                  <li className="space-y-1">
                    <strong>Speak Text</strong>
                    <p className="text-muted-foreground text-xs ml-5">
                      Use the dictionary value so Siri confirms what was added.
                    </p>
                  </li>
                </ol>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => void copyText(setupStepsText, 'steps')}
                >
                  {copied === 'steps' ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copied full setup
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy full setup (with your values)
                    </>
                  )}
                </Button>

                <Button className="w-full" onClick={() => setStep(3)}>
                  Continue to Siri setup →
                </Button>
              </section>
            )}

            {step === 3 && (
              <section className="space-y-4">
                <div>
                  <h3 className="font-medium mb-1">3. Add to Siri</h3>
                  <p className="text-sm text-muted-foreground">
                    In the Shortcuts app, tap your new shortcut → <strong>ⓘ</strong> →{' '}
                    <strong>Add to Siri</strong>.
                  </p>
                </div>

                <ol className="list-decimal list-inside space-y-2 text-sm">
                  <li>
                    Record a phrase, for example:{' '}
                    <strong>&ldquo;Update home organizer&rdquo;</strong>
                  </li>
                  <li>
                    Say the full command in one go, e.g.{' '}
                    <strong>&ldquo;Hey Siri, update home organizer — add milk to pantry&rdquo;</strong>
                  </li>
                  <li>
                    Or use the shortcut with Ask for Input and speak when prompted.
                  </li>
                </ol>

                <div className="rounded-lg bg-accent/50 px-3 py-2 text-xs space-y-2">
                  <p>
                    <strong>Example phrases:</strong>
                  </p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>&ldquo;Add milk to shopping list&rdquo;</li>
                    <li>&ldquo;Buy eggs and bread&rdquo;</li>
                    <li>&ldquo;We&apos;re out of butter&rdquo; (adds to shopping list)</li>
                    <li>&ldquo;Add 2 gallons milk to pantry&rdquo;</li>
                    <li>&ldquo;Put toilet paper in supply&rdquo;</li>
                    <li>&ldquo;Remove milk from pantry&rdquo;</li>
                    <li>&ldquo;Used the last of the eggs&rdquo;</li>
                    <li>&ldquo;Remove eggs from shopping list&rdquo;</li>
                  </ul>
                </div>

                <div className="rounded-lg bg-accent/50 px-3 py-2 text-xs space-y-1">
                  <p>
                    <strong>Tips:</strong>
                  </p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Multiple items: &ldquo;milk and eggs&rdquo; or &ldquo;milk, eggs&rdquo;</li>
                    <li>Quantities: &ldquo;2 gallons milk&rdquo; or &ldquo;3x apples&rdquo;</li>
                    <li>Say <strong>pantry</strong>, <strong>supply</strong>, or <strong>shopping list</strong> to target the right place</li>
                    <li>Changes sync to the app immediately</li>
                    <li>Redeploy the Edge Function after updating (see note below)</li>
                  </ul>
                </div>

                <div className="rounded-lg border px-3 py-2 text-xs text-muted-foreground">
                  <strong className="text-foreground">One-time deploy:</strong> Run migration{' '}
                  <code>007_shortcut_tokens.sql</code> in Supabase, then deploy the function:{' '}
                  <code className="break-all">supabase functions deploy add-shopping-item</code>
                </div>

                {!token && hasToken && displayToken && (
                  <p className="text-xs text-muted-foreground">
                    Your token is already saved on the server. If you don&apos;t have it copied in
                    Shortcuts yet, regenerate it in Step 1.
                  </p>
                )}
              </section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function buildSetupStepsText({
  apiUrl,
  anonKey,
  token,
}: {
  apiUrl: string
  anonKey: string
  token: string
}): string {
  return `Home Organizer — Siri Shortcut Setup

STEP 1 — Token (already generated in app):
${token}

STEP 2 — Create shortcut in Shortcuts app:

Action 1: Ask for Input
  Prompt: "What do you want to do?"
  (Or use Shortcut Input if using Siri phrase)

Action 2: Get Contents of URL
  URL: ${apiUrl}
  Method: POST
  Headers:
    Content-Type: application/json
    apikey: ${anonKey}
    X-Shortcut-Token: ${token}
  Request Body (JSON):
    { "text": "[Provided Input or Shortcut Input]" }

Action 3: Get Dictionary Value
  Key: message

Action 4: Speak Text
  (Use dictionary value)

STEP 3 — Add to Siri
  Shortcut → ⓘ → Add to Siri
  Suggested phrase: "Update home organizer"

EXAMPLE COMMANDS:
  "Add milk to shopping list"
  "Buy eggs and bread"
  "We're out of butter"
  "Add 2 gallons milk to pantry"
  "Put toilet paper in supply"
  "Remove milk from pantry"
  "Used the last of the eggs"
`
}
