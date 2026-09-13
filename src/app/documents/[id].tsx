import { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import { colors, radius, spacing } from '@/theme';
import { deleteDocument, DocumentRecord, getDocumentById, KIND_LABEL, readDocumentContent } from '@/data/documents';
import { useAuth } from '@/services/auth';
import { exportCsv, exportPdf, exportText } from '@/lib/export';
import { notify } from '@/lib/toast';
import { formatDate } from '@/lib/date';
import { AppText, Button, EmptyState, GradientHeader, Icon } from '@/ui';

/** Escape text so it renders literally inside the preview HTML. */
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** For CSV / text documents, wrap the content in a minimal readable page. */
function textPreviewHtml(content: string, format: 'csv' | 'text'): string {
  const body =
    format === 'csv'
      ? `<table>${content
          .split(/\r?\n/)
          .filter((l) => l.length)
          .map((line, i) => `<tr>${line.split(',').map((c) => `<${i === 0 ? 'th' : 'td'}>${escapeHtml(c.replace(/^"|"$/g, ''))}</${i === 0 ? 'th' : 'td'}>`).join('')}</tr>`)
          .join('')}</table>`
      : `<pre>${escapeHtml(content)}</pre>`;
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body{font-family:-apple-system,Roboto,Arial,sans-serif;color:#1c2411;margin:0;padding:16px;font-size:13px}
    pre{white-space:pre-wrap;word-break:break-word;font:12px/1.5 monospace;margin:0}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th{background:#f3f5ef;text-align:left;padding:7px 9px;border-bottom:1px solid #e5e7eb;color:#3f4d2d}
    td{padding:6px 9px;border-bottom:1px solid #eee}
  </style></head><body>${body}</body></html>`;
}

/**
 * Document preview (Sep 12 2026 documents module): renders a stored document —
 * the brand-styled Ngaren PDF/HTML, or a CSV/text file — and lets the owner
 * re-share or delete it. This is what a report or Health Score Card opens into
 * when generated, so it's previewed (and branded) before it's shared.
 */
export default function DocumentPreview() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { loading, isAuthenticated } = useAuth();
  const [doc, setDoc] = useState<DocumentRecord | null | undefined>(undefined);
  const [content, setContent] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getDocumentById(String(id)).then(async (rec) => {
        if (!active) return;
        setDoc(rec ?? null);
        if (rec) setContent(await readDocumentContent(rec));
      });
      return () => {
        active = false;
      };
    }, [id]),
  );

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;

  if (doc === null) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <GradientHeader title="Document" showBack />
        <EmptyState icon="file-remove-outline" title="Document not found" subtitle="It may have been deleted or expired." />
      </View>
    );
  }
  if (doc === undefined) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <GradientHeader title="Document" showBack />
      </View>
    );
  }

  const format = doc.format ?? 'pdf';
  const previewHtml =
    content == null ? null : format === 'pdf' ? content : textPreviewHtml(content, format);

  const onShare = async () => {
    if (content == null) return;
    setSharing(true);
    try {
      const name = doc.filename ?? `${doc.title}.${format === 'pdf' ? 'pdf' : format === 'csv' ? 'csv' : 'txt'}`;
      const ok =
        format === 'pdf' ? await exportPdf(name, content) : format === 'csv' ? await exportCsv(name, content) : await exportText(name, content);
      if (!ok) Alert.alert('Sharing unavailable', 'Could not open the share sheet on this device.');
    } finally {
      setSharing(false);
    }
  };

  const onDelete = () => {
    Alert.alert('Delete document', `Remove “${doc.title}”?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteDocument(doc.id);
          notify('Document deleted');
          router.back();
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={doc.title} subtitle={`${KIND_LABEL[doc.kind]} · ${format.toUpperCase()} · ${formatDate(doc.createdAt.slice(0, 10))}`} showBack />
      <View style={{ flex: 1, margin: spacing.md, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.divider, backgroundColor: '#fff' }}>
        {previewHtml != null ? (
          <WebView
            originWhitelist={['*']}
            source={{ html: previewHtml }}
            style={{ flex: 1, backgroundColor: '#fff' }}
            scalesPageToFit
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
            <Icon name="file-alert-outline" size={40} color={colors.onSurfaceVariant} />
            <AppText variant="body" color={colors.onSurfaceVariant} style={{ marginTop: spacing.sm, textAlign: 'center' }}>
              This document’s content is no longer stored on this device. You can delete this entry.
            </AppText>
          </View>
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.lg }}>
        <Button label="Delete" variant="outline" icon="trash-can-outline" onPress={onDelete} style={{ flex: 1 }} />
        <Button label={sharing ? 'Sharing…' : 'Share'} icon="share-variant-outline" loading={sharing} disabled={content == null} onPress={onShare} style={{ flex: 2 }} />
      </View>
    </View>
  );
}
