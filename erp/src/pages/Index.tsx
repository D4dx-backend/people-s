import { ArrowRight, Shield, Users, TrendingUp, Heart, FileText, IndianRupee, MapPin, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useConfig } from "@/contexts/ConfigContext";
import { useOrgLogoUrl } from "@/hooks/useOrgLogoUrl";
import defaultLogo from "@/assets/logo.png";
import { useNavigate } from "react-router-dom";

const featuredSchemes = [
  {
    id: "1",
    name: "Education Support",
    description: "Financial assistance for students from economically weaker sections",
    amount: "₹10,000 - ₹50,000",
    beneficiaries: 150,
  },
  {
    id: "2",
    name: "Healthcare Assistance",
    description: "Medical support for critical health conditions",
    amount: "₹25,000 - ₹1,00,000",
    beneficiaries: 89,
  },
  {
    id: "3",
    name: "Small Business Grant",
    description: "Startup capital for entrepreneurs",
    amount: "₹50,000 - ₹2,00,000",
    beneficiaries: 45,
  },
];

const activeProjects = [
  { name: "Education Initiative 2025", location: "Malappuram", beneficiaries: 200 },
  { name: "Healthcare Outreach", location: "Kozhikode", beneficiaries: 150 },
  { name: "Livelihood Support", location: "Kannur", beneficiaries: 120 },
];

export default function Index() {
  const navigate = useNavigate();
  const { org } = useConfig();
  const orgLogoUrl = useOrgLogoUrl();

  return (
    <div className="min-h-screen bg-background">
      {/* Header/Navbar */}
      <header className="border-b border-border/40 bg-background/80 sticky top-0 z-50 shadow-sm backdrop-blur-xl">
        <div className="container relative mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src={orgLogoUrl} alt={org.erpTitle} className="h-12 w-12 rounded-2xl shadow-sm" onError={(e) => { (e.target as HTMLImageElement).src = defaultLogo; }} />
            <div>
              <h1 className="text-lg font-bold">{org.erpTitle}</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">{org.tagline}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => navigate("/schemes")}>
              Schemes
            </Button>
            <Button className="rounded-full shadow-glow" onClick={() => navigate("/login")}>
              Login
            </Button>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-primary opacity-40" />
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-hero">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNnptLTE4IDBjMy4zMTQgMCA2IDIuNjg2IDYgNnMtMi42ODYgNi02IDYtNi0yLjY4Ni02LTYgMi42ODYtNiA2LTZ6bTM2IDBjMy4zMTQgMCA2IDIuNjg2IDYgNnMtMi42ODYgNi02IDYtNi0yLjY4Ni02LTYgMi42ODYtNiA2LTZ6IiBzdHJva2U9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9nPjwvc3ZnPg==')] opacity-20" />
        <div className="absolute -left-20 top-10 h-56 w-56 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -right-20 bottom-10 h-64 w-64 rounded-full bg-secondary/20 blur-3xl" />
        
        <div className="container relative mx-auto px-4 py-20 md:py-28">
          <div className="flex flex-col items-center text-center space-y-6">
            <img 
              src={orgLogoUrl} 
              alt={org.erpTitle} 
              className="h-24 w-24 md:h-32 md:w-32 rounded-3xl shadow-glow animate-in zoom-in duration-500"
              onError={(e) => { (e.target as HTMLImageElement).src = defaultLogo; }}
            />
            
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom duration-700">
              <h1 className="text-3xl md:text-5xl font-bold text-primary-foreground">
                {org.erpTitle}
              </h1>
              <p className="text-lg md:text-xl text-primary-foreground/90 max-w-2xl">
                {org.tagline}
              </p>
              <p className="text-base text-primary-foreground/80 max-w-xl">
                {org.heroSubtext}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 animate-in fade-in slide-in-from-bottom duration-1000">
              <Button 
                size="lg" 
                className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-glow rounded-full px-8"
                onClick={() => navigate('/schemes')}
              >
                Browse Schemes
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="bg-white/10 text-primary-foreground border-2 border-primary-foreground hover:bg-white/20 shadow-glow rounded-full px-8"
                onClick={() => navigate('/login')}
              >
                Apply Now
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-12 md:py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">About {org.erpTitle}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {org.aboutText}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 ">
            {[
              {
                icon: Shield,
                title: "Transparent Operations",
                description: "Complete transparency in fund collection and distribution with real-time tracking",
              },
              {
                icon: Users,
                title: "Community Focused",
                description: "Direct support to families and individuals in need across all regions",
              },
              {
                icon: TrendingUp,
                title: "Measurable Impact",
                description: "Track record of transforming lives through targeted assistance programs",
              },
              {
                icon: Heart,
                title: org.communityLabel,
                description: org.communityDescription,
              },
            ].map((feature, idx) => (
              <Card key={idx} className="group hover:shadow-glow transition-all duration-300 hover:-translate-y-1">
                <CardContent className="p-6 text-center space-y-3 pt-6">
                  <div className="h-14 w-14 rounded-2xl bg-gradient-primary mx-auto flex items-center justify-center shadow-elegant transition-transform duration-300 group-hover:-translate-y-0.5">
                    <feature.icon className="h-7 w-7 text-primary-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Schemes */}
      <section className="py-12 md:py-16 bg-muted/20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Our Assistance Schemes</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Comprehensive support programs designed to address various needs of our community
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {featuredSchemes.map((scheme) => (
              <Card key={scheme.id} className="group hover:shadow-glow transition-all duration-300 hover:-translate-y-1">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{scheme.name}</CardTitle>
                  <CardDescription className="line-clamp-2">{scheme.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <IndianRupee className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">{scheme.amount}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{scheme.beneficiaries} Beneficiaries Supported</span>
                  </div>
                  <Button className="w-full mt-2 rounded-full" onClick={() => navigate('/schemes')}>
                    Learn More
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center mt-8">
            <Button size="lg" variant="outline" className="rounded-full" onClick={() => navigate('/schemes')}>
              View All Schemes
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Active Projects */}
      <section className="py-12 md:py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Active Projects</h2>
            <p className="text-muted-foreground">Ongoing initiatives making a difference</p>
          </div>

          <div className="grid gap-6 md:grid-cols-3 max-w-4xl mx-auto">
            {activeProjects.map((project, idx) => (
              <Card key={idx} className="hover:shadow-glow transition-all duration-300 hover:-translate-y-1">
                <CardHeader>
                  <CardTitle className="text-base">{project.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{project.location}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{project.beneficiaries} beneficiaries</span>
                  </div>
                  <Badge className="mt-2 rounded-full">Active</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 md:py-16 bg-gradient-primary">
        <div className="container mx-auto px-4">
          <div className="rounded-3xl border border-white/10 bg-white/10 p-8 md:p-10 backdrop-blur">
            <div className="grid gap-8 md:grid-cols-4">
              {[
                { label: "Active Schemes", value: "12+" },
                { label: "Beneficiaries Helped", value: "2,500+" },
                { label: "Districts Covered", value: "14" },
                { label: "Funds Distributed", value: "₹2.5Cr+" },
              ].map((stat, idx) => (
                <div key={idx} className="text-center space-y-2">
                  <p className="text-3xl md:text-4xl font-bold text-primary-foreground">{stat.value}</p>
                  <p className="text-sm md:text-base text-primary-foreground/90">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 md:py-16 bg-background">
        <div className="container mx-auto px-4 text-center">
          <div className="relative overflow-hidden rounded-3xl border border-border/40 bg-gradient-to-r from-primary/10 via-background to-secondary/10 p-8 md:p-10 shadow-elegant">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Need Assistance? We're Here to Help
            </h2>
            <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
              Apply for our assistance programs and let us support you in your journey towards a better tomorrow
            </p>
            <Button 
              size="lg" 
              className="bg-gradient-primary shadow-glow rounded-full px-8"
              onClick={() => navigate('/schemes')}
            >
              Apply for Assistance
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-muted/30 border-t border-border/40 py-8">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-3 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <img src={orgLogoUrl} alt="Logo" className="h-10 w-10 rounded-2xl shadow-sm" onError={(e) => { (e.target as HTMLImageElement).src = defaultLogo; }} />
                <div>
                  <h3 className="font-bold">{org.erpTitle}</h3>
                  <p className="text-xs text-muted-foreground">{org.tagline}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                {org.footerText}
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-3">Quick Links</h4>
              <div className="space-y-2 text-sm">
                <button onClick={() => navigate('/schemes')} className="block text-muted-foreground hover:text-foreground">
                  Browse Schemes
                </button>
                <button onClick={() => navigate('/login')} className="block text-muted-foreground hover:text-foreground">
                  Apply Now
                </button>
                <button onClick={() => navigate('/login')} className="block text-muted-foreground hover:text-foreground">
                  Admin Login
                </button>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold mb-3">Contact Us</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  <span>{org.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <span>{org.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>{org.address}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="border-t pt-6 text-center text-sm text-muted-foreground">
            <p>{org.copyrightText}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
