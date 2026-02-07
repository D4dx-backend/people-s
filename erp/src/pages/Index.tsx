import { ArrowRight, Shield, Users, TrendingUp, Heart, FileText, IndianRupee, MapPin, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import logo from "@/assets/logo.png";
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header/Navbar */}
      <header className="border-b border-border bg-background sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src={logo} alt="People's Foundation ERP" className="h-12 w-12 rounded-full" />
            <div>
              <h1 className="text-lg font-bold">People's Foundation ERP</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Empowering Communities</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/schemes")}>
              Schemes
            </Button>
            <Button onClick={() => navigate("/login")}>
              Login
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-hero">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNnptLTE4IDBjMy4zMTQgMCA2IDIuNjg2IDYgNnMtMi42ODYgNi02IDYtNi0yLjY4Ni02LTYgMi42ODYtNiA2LTZ6bTM2IDBjMy4zMTQgMCA2IDIuNjg2IDYgNnMtMi42ODYgNi02IDYtNi0yLjY4Ni02LTYgMi42ODYtNiA2LTZ6IiBzdHJva2U9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9nPjwvc3ZnPg==')] opacity-20" />
        
        <div className="container relative mx-auto px-4 py-16 md:py-24">
          <div className="flex flex-col items-center text-center space-y-6">
            <img 
              src={logo} 
              alt="People's Foundation ERP" 
              className="h-24 w-24 md:h-32 md:w-32 rounded-full shadow-glow animate-in zoom-in duration-500"
            />
            
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom duration-700">
              <h1 className="text-3xl md:text-5xl font-bold text-primary-foreground">
                People's Foundation ERP
              </h1>
              <p className="text-lg md:text-xl text-primary-foreground/90 max-w-2xl">
                Empowering Communities Through Zakat and Charitable Programs
              </p>
              <p className="text-base text-primary-foreground/80 max-w-xl">
                Transforming lives through transparent distribution of Zakat, supporting education, healthcare, and livelihood initiatives across Kerala
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 animate-in fade-in slide-in-from-bottom duration-1000">
              <Button 
                size="lg" 
                className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-glow"
                onClick={() => navigate('/schemes')}
              >
                Browse Schemes
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="bg-white/10 text-primary-foreground border-2 border-primary-foreground hover:bg-white/20 shadow-glow"
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
            <h2 className="text-2xl md:text-3xl font-bold mb-4">About People's Foundation ERP</h2>
            <p className="text-muted-foreground leading-relaxed">
              People's Foundation ERP is dedicated to the transparent and effective distribution of Zakat funds 
              to support the underprivileged communities across Kerala. We run comprehensive programs in 
              education, healthcare, housing, and livelihood development, ensuring that assistance reaches 
              those who need it most.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Shield,
                title: "Transparent Operations",
                description: "Complete transparency in fund collection and distribution with real-time tracking",
              },
              {
                icon: Users,
                title: "Community Focused",
                description: "Direct support to families and individuals in need across Kerala",
              },
              {
                icon: TrendingUp,
                title: "Measurable Impact",
                description: "Track record of transforming lives through targeted assistance programs",
              },
              {
                icon: Heart,
                title: "Islamic Values",
                description: "Guided by Islamic principles of charity, compassion, and social justice",
              },
            ].map((feature, idx) => (
              <Card key={idx} className="hover:shadow-elegant transition-all duration-300 hover:-translate-y-1">
                <CardContent className="p-6 text-center space-y-3">
                  <div className="h-14 w-14 rounded-full bg-gradient-primary mx-auto flex items-center justify-center">
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
      <section className="py-12 md:py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Our Assistance Schemes</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Comprehensive support programs designed to address various needs of our community
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {featuredSchemes.map((scheme) => (
              <Card key={scheme.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
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
                  <Button className="w-full mt-2" onClick={() => navigate('/schemes')}>
                    Learn More
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center mt-8">
            <Button size="lg" variant="outline" onClick={() => navigate('/schemes')}>
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
            <p className="text-muted-foreground">Ongoing initiatives making a difference across Kerala</p>
          </div>

          <div className="grid gap-6 md:grid-cols-3 max-w-4xl mx-auto">
            {activeProjects.map((project, idx) => (
              <Card key={idx}>
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
                  <Badge className="mt-2">Active</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 md:py-16 bg-gradient-primary">
        <div className="container mx-auto px-4">
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
      </section>

      {/* CTA Section */}
      <section className="py-12 md:py-16 bg-background">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Need Assistance? We're Here to Help
          </h2>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
            Apply for our assistance programs and let us support you in your journey towards a better tomorrow
          </p>
          <Button 
            size="lg" 
            className="bg-gradient-primary shadow-glow"
            onClick={() => navigate('/schemes')}
          >
            Apply for Assistance
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-muted/40 border-t border-border py-8">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-3 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <img src={logo} alt="Logo" className="h-10 w-10 rounded-full" />
                <div>
                  <h3 className="font-bold">People's Foundation ERP</h3>
                  <p className="text-xs text-muted-foreground">Empowering Communities</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Dedicated to transparent Zakat distribution and community welfare across Kerala
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
                  <span>+91 1234567890</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <span>info@baithuzzakath.org</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>Kerala, India</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="border-t pt-6 text-center text-sm text-muted-foreground">
            <p>&copy; 2025 People's Foundation ERP. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
