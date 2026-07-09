import { Component, ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { colors, radius, spacing } from '@/theme';
import { AppText, Icon } from '@/ui';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * App-wide JS error boundary. Any render-phase exception anywhere below the
 * root layout is caught here and replaced with a branded "something went wrong"
 * screen with a retry, instead of a white screen or an abrupt crash. This does
 * NOT catch native crashes (those are handled at the native/packaging layer),
 * but it turns every recoverable JS failure into a graceful, on-brand recovery
 * — a meaningful UX safety net for real-world network/data hiccups.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    // Keep a breadcrumb in the device log for diagnostics without crashing.
    console.warn('AppErrorBoundary caught an error:', error);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.lg,
          gap: spacing.md,
        }}>
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: 48,
            backgroundColor: colors.primaryTint,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon name="alert-circle-outline" size={48} color={colors.primary} />
        </View>
        <AppText variant="title" style={{ textAlign: 'center' }}>
          Something went wrong
        </AppText>
        <AppText
          variant="body"
          color={colors.onSurfaceVariant}
          style={{ textAlign: 'center', maxWidth: 300 }}>
          The app hit an unexpected problem. Your data is safe — please try again.
        </AppText>
        <Pressable
          onPress={this.handleRetry}
          style={{
            marginTop: spacing.sm,
            backgroundColor: colors.primary,
            paddingHorizontal: spacing.xl,
            paddingVertical: spacing.md,
            borderRadius: radius.full,
          }}>
          <AppText variant="bodyLarge" color="#fff" style={{ fontWeight: '600' }}>
            Try again
          </AppText>
        </Pressable>
      </View>
    );
  }
}
