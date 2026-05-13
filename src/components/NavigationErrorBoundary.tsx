'use client';

import { Component, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Catches client-side errors during navigation (e.g. aborted RSC streams)
 * and auto-reloads the current page rather than showing the crash overlay.
 */
class NavigationErrorBoundaryInner extends Component<Props & { router: ReturnType<typeof useRouter> }, State> {
  constructor(props: Props & { router: ReturnType<typeof useRouter> }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch() {
    // Auto-recover: refresh the current route data and reset the boundary
    setTimeout(() => {
      this.props.router.refresh();
      this.setState({ hasError: false });
    }, 100);
  }

  render() {
    if (this.state.hasError) {
      // Show nothing briefly while recovering
      return null;
    }
    return this.props.children;
  }
}

export function NavigationErrorBoundary({ children }: Props) {
  const router = useRouter();
  return (
    <NavigationErrorBoundaryInner router={router}>
      {children}
    </NavigationErrorBoundaryInner>
  );
}
