import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "../core/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../core/ui/card";

interface Props {
  children?: ReactNode;
  featureName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`ErrorBoundary caught an error in [${this.props.featureName || "Unknown Feature"}]:`, error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center p-6 min-h-[400px]">
          <Card className="max-w-md w-full border-destructive/50 shadow-lg">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="p-3 rounded-full bg-destructive/10 text-destructive">
                  <AlertCircle className="h-8 w-8" />
                </div>
              </div>
              <CardTitle className="text-xl text-destructive font-bold">
                Feature Crash Detected
              </CardTitle>
              <CardDescription className="text-muted-foreground font-medium">
                {this.props.featureName || "This part of the app"} encountered a technical error and stopped working.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted p-3 rounded-md text-xs font-mono overflow-auto max-h-[100px] border border-border">
                {this.state.error?.message || "No error details available."}
              </div>
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Don't worry, the rest of the application is still running. You can try to reload this feature or use other sections.
              </p>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button 
                onClick={this.handleRetry}
                variant="default"
                className="w-full font-bold"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry Loading
              </Button>
              <Button 
                onClick={() => window.location.reload()}
                variant="outline"
                className="w-full"
              >
                Reload Whole App
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
