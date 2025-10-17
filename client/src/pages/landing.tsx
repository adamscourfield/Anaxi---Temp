import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AuthForm } from "@/components/auth-form";
import { useAuth } from "@/hooks/use-auth";
import { Eye, Users, MessageSquare, TrendingUp, CheckCircle, ArrowRight } from "lucide-react";
import anaxiLogo from "@assets/7_1760131494886.png";
import iphoneMockup from "@assets/stock_images/modern_iphone_mockup_c4899914.jpg";
import macbookMockup from "@assets/stock_images/macbook_pro_laptop_m_c6078745.jpg";
import dashboardWidget from "@assets/Screenshot 2025-10-13 at 16.17.26_1760368668464.png";

export default function Landing() {
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  if (user) {
    setLocation("/dashboard");
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={anaxiLogo} alt="Anaxi" className="h-8 w-8" />
            <h1 className="text-2xl font-bold">Anaxi</h1>
          </div>
          <Button onClick={() => setShowAuthDialog(true)} data-testid="button-login">
            Log In
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="flex-1 relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background" />
        
        <div className="container relative mx-auto px-4 py-20 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left column - Content */}
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
                <CheckCircle className="w-4 h-4" />
                Trusted by Schools Worldwide
              </div>
              
              <h2 className="text-5xl lg:text-6xl font-bold tracking-tight">
                Professional Teacher
                <span className="block text-primary">Observation Platform</span>
              </h2>
              
              <p className="text-xl text-muted-foreground max-w-xl">
                Empower educators with peer observations, structured feedback, and data-driven professional development tracking.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  size="lg" 
                  onClick={() => setShowAuthDialog(true)} 
                  data-testid="button-login-cta"
                  className="group"
                >
                  Get Started
                  <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  onClick={() => {
                    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  data-testid="button-learn-more"
                >
                  Learn More
                </Button>
              </div>

              {/* Key stats */}
              <div className="grid grid-cols-3 gap-6 pt-8 border-t">
                <div>
                  <div className="text-3xl font-bold text-primary">98%</div>
                  <div className="text-sm text-muted-foreground">Teacher Satisfaction</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-primary">50K+</div>
                  <div className="text-sm text-muted-foreground">Observations</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-primary">200+</div>
                  <div className="text-sm text-muted-foreground">Schools</div>
                </div>
              </div>
            </div>

            {/* Right column - Device mockups */}
            <div className="relative lg:h-[600px] flex items-center justify-center">
              {/* MacBook mockup */}
              <div className="relative z-10 transform -rotate-2 hover:rotate-0 transition-transform duration-500">
                <div className="relative">
                  <img 
                    src={macbookMockup} 
                    alt="MacBook Pro" 
                    className="w-full max-w-2xl drop-shadow-2xl"
                  />
                  {/* Dashboard overlay on MacBook screen */}
                  <div className="absolute top-[8%] left-[13%] right-[13%] bottom-[32%] bg-gradient-to-br from-primary/5 to-background rounded-sm overflow-hidden">
                    <div className="w-full h-full bg-background/50 backdrop-blur-sm flex items-center justify-center">
                      <img 
                        src={dashboardWidget} 
                        alt="Dashboard" 
                        className="w-1/2 object-contain"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* iPhone mockup */}
              <div className="absolute bottom-0 right-0 lg:right-12 z-20 transform rotate-6 hover:rotate-3 transition-transform duration-500">
                <div className="relative w-48 lg:w-56">
                  <img 
                    src={iphoneMockup} 
                    alt="iPhone" 
                    className="w-full drop-shadow-2xl"
                  />
                  {/* Dashboard overlay on iPhone screen */}
                  <div className="absolute top-[6%] left-[9%] right-[9%] bottom-[6%] bg-gradient-to-br from-primary/10 to-background rounded-[2rem] overflow-hidden">
                    <div className="w-full h-full bg-background/50 backdrop-blur-sm" />
                  </div>
                </div>
              </div>

              {/* Decorative elements */}
              <div className="absolute top-1/4 left-0 w-72 h-72 bg-primary/10 rounded-full blur-3xl -z-10" />
              <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -z-10" />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h3 className="text-3xl lg:text-4xl font-bold mb-4">
              Everything You Need for Teacher Development
            </h3>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              A comprehensive platform designed by educators, for educators
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="p-8 bg-card border rounded-lg hover-elevate group">
              <div className="w-14 h-14 bg-primary/10 rounded-lg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Eye className="w-7 h-7 text-primary" />
              </div>
              <h4 className="text-xl font-semibold mb-3">Peer Observations</h4>
              <p className="text-muted-foreground">
                Use custom rubrics to conduct meaningful classroom observations with structured frameworks
              </p>
            </div>

            <div className="p-8 bg-card border rounded-lg hover-elevate group">
              <div className="w-14 h-14 bg-primary/10 rounded-lg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Users className="w-7 h-7 text-primary" />
              </div>
              <h4 className="text-xl font-semibold mb-3">Teacher Groups</h4>
              <p className="text-muted-foreground">
                Organize teachers by department or specialty for targeted support and collaboration
              </p>
            </div>

            <div className="p-8 bg-card border rounded-lg hover-elevate group">
              <div className="w-14 h-14 bg-primary/10 rounded-lg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <MessageSquare className="w-7 h-7 text-primary" />
              </div>
              <h4 className="text-xl font-semibold mb-3">Structured Feedback</h4>
              <p className="text-muted-foreground">
                Provide habit-based feedback that drives meaningful professional growth and development
              </p>
            </div>

            <div className="p-8 bg-card border rounded-lg hover-elevate group">
              <div className="w-14 h-14 bg-primary/10 rounded-lg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <TrendingUp className="w-7 h-7 text-primary" />
              </div>
              <h4 className="text-xl font-semibold mb-3">Track Progress</h4>
              <p className="text-muted-foreground">
                Monitor development trends and celebrate teaching excellence with comprehensive analytics
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-primary/10 via-primary/5 to-background">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-3xl mx-auto space-y-8">
            <h3 className="text-4xl lg:text-5xl font-bold">
              Ready to Transform Teacher Development?
            </h3>
            <p className="text-xl text-muted-foreground">
              Join hundreds of schools using Anaxi to elevate professional learning
            </p>
            <Button 
              size="lg" 
              onClick={() => setShowAuthDialog(true)} 
              data-testid="button-login-footer"
              className="group"
            >
              Get Started Today
              <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Anaxi. All rights reserved.</p>
        </div>
      </footer>

      {/* Auth Dialog */}
      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent className="sm:max-w-md" aria-describedby="auth-dialog-description">
          <span id="auth-dialog-description" className="sr-only">
            Login to access the Anaxi platform
          </span>
          <AuthForm />
        </DialogContent>
      </Dialog>
    </div>
  );
}
