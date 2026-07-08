"use client"

import * as React from "react"
import { Crepe } from "@milkdown/crepe"
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react"
import { CheckIcon, EditIcon, XIcon } from "lucide-react"

import { Button } from "#/components/ui/button.tsx"
import { Input } from "#/components/ui/input.tsx"
import { Label } from "#/components/ui/label.tsx"
import { cn } from "#/lib/utils.ts"

export type BrandVoiceDraft = {
  brandName: string
  productUrl: string
  brandDnaMarkdown: string
  imagePromptModifier: string
  model: string
}

export function BrandVoiceEditor({
  value,
  documentKey,
  editable,
  showModeToggle = false,
  saving = false,
  saveLabel = "Save brand voice",
  emptyLabel = "Brand voice has not been approved yet.",
  onChange,
  onEditableChange,
  onSave,
  onCancel,
}: {
  value: BrandVoiceDraft
  documentKey?: string
  editable: boolean
  showModeToggle?: boolean
  saving?: boolean
  saveLabel?: string
  emptyLabel?: string
  onChange: (value: BrandVoiceDraft) => void
  onEditableChange?: (editable: boolean) => void
  onSave?: () => void
  onCancel?: () => void
}) {
  const canSave =
    value.brandName.trim() &&
    value.brandDnaMarkdown.trim() &&
    value.imagePromptModifier.trim()

  return (
    <section
      className={cn(
        "grid gap-5 border bg-card/60 p-4 transition-colors",
        editable && "border-primary/40 bg-primary/5",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-heading text-xl font-semibold">Brand Voice</h2>
          <p className="text-sm text-muted-foreground">
            {editable ? "Editing brand voice" : "Read-only brand voice"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {showModeToggle && !editable ? (
            <Button type="button" size="sm" onClick={() => onEditableChange?.(true)}>
              <EditIcon />
              Edit
            </Button>
          ) : null}
          {showModeToggle && editable ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onCancel?.()
                onEditableChange?.(false)
              }}
            >
              <XIcon />
              Cancel
            </Button>
          ) : null}
          {onSave && editable ? (
            <Button
              type="button"
              size="sm"
              disabled={saving || !canSave}
              onClick={onSave}
            >
              <CheckIcon />
              {saving ? "Saving..." : saveLabel}
            </Button>
          ) : null}
        </div>
      </div>

      {!value.brandDnaMarkdown.trim() && !editable ? (
        <div className="border bg-background/70 px-4 py-8 text-sm text-muted-foreground">
          {emptyLabel}
        </div>
      ) : (
        <div className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="brand-voice-name">Brand name</Label>
            <Input
              id="brand-voice-name"
              value={value.brandName}
              readOnly={!editable}
              placeholder="Brand name"
              onChange={(event) =>
                onChange({ ...value, brandName: event.target.value })
              }
            />
          </div>

          <div className="grid gap-2">
            <Label>Brand DNA</Label>
            <MilkdownMarkdown
              documentKey={documentKey}
              value={value.brandDnaMarkdown}
              editable={editable}
              placeholder="Brand DNA will appear here when ingestion finishes."
              onChange={(brandDnaMarkdown) =>
                onChange({ ...value, brandDnaMarkdown })
              }
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="brand-voice-image-prompt">Image prompt modifier</Label>
            <textarea
              id="brand-voice-image-prompt"
              className={cn(
                "min-h-28 w-full resize-y border bg-background/70 p-3 text-sm leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
                !editable && "resize-none bg-muted/30",
              )}
              value={value.imagePromptModifier}
              readOnly={!editable}
              placeholder="Image prompt modifier will appear here when ingestion finishes."
              onChange={(event) =>
                onChange({ ...value, imagePromptModifier: event.target.value })
              }
            />
          </div>

          <div className="grid gap-1 text-xs text-muted-foreground">
            {value.productUrl ? <div>Source: {value.productUrl}</div> : null}
            <div>Model: {value.model || "unknown"}</div>
          </div>
        </div>
      )}
    </section>
  )
}

function MilkdownMarkdown({
  value,
  documentKey,
  editable,
  placeholder,
  onChange,
}: {
  value: string
  documentKey?: string
  editable: boolean
  placeholder: string
  onChange: (value: string) => void
}) {
  return (
    <div
      className={cn(
        "brand-voice-milkdown min-h-72 border bg-background/70",
        editable && "brand-voice-milkdown-editing",
      )}
    >
      <MilkdownProvider key={documentKey ?? value}>
        <CrepeMarkdownEditor
          value={value}
          editable={editable}
          placeholder={placeholder}
          onChange={onChange}
        />
      </MilkdownProvider>
    </div>
  )
}

function CrepeMarkdownEditor({
  value,
  editable,
  placeholder,
  onChange,
}: {
  value: string
  editable: boolean
  placeholder: string
  onChange: (value: string) => void
}) {
  const crepeRef = React.useRef<Crepe | null>(null)
  const valueRef = React.useRef(value)
  const onChangeRef = React.useRef(onChange)
  valueRef.current = value
  onChangeRef.current = onChange

  useEditor((root) => {
    const crepe = new Crepe({
      root,
      defaultValue: value || placeholder,
      features: {
        [Crepe.Feature.AI]: false,
        [Crepe.Feature.ImageBlock]: false,
      },
      featureConfigs: {
        [Crepe.Feature.Placeholder]: {
          text: placeholder,
        },
      },
    })

    crepe.setReadonly(!editable)
    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown) => {
        if (markdown !== valueRef.current) onChangeRef.current(markdown)
      })
    })
    crepeRef.current = crepe
    return crepe
  }, [])

  React.useEffect(() => {
    const crepe = crepeRef.current
    if (!crepe) return
    crepe.setReadonly(!editable)
  }, [editable])

  return <Milkdown />
}
