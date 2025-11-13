import { Card } from "@/components/ui/card";
import { PlayCircle, Clock, Sparkles } from "lucide-react";
import Navigation from "@/components/Navigation";

const meditations = [
  {
    title: "Утренняя медитация",
    duration: "10 мин",
    description: "Начните день с позитивной энергией и ясностью ума",
    thumbnail: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400&h=225&fit=crop",
    videoUrl: "https://www.youtube.com/embed/inpok4MKVLM"
  },
  {
    title: "Медитация для сна",
    duration: "20 мин",
    description: "Расслабьтесь и подготовьтесь к глубокому восстанавливающему сну",
    thumbnail: "https://images.unsplash.com/photo-1495954484750-af469f2f9be5?w=400&h=225&fit=crop",
    videoUrl: "https://www.youtube.com/embed/z6X5oEIg6Ak"
  },
  {
    title: "Снятие стресса",
    duration: "15 мин",
    description: "Освободитесь от напряжения и беспокойства",
    thumbnail: "https://images.unsplash.com/photo-1499209974431-9dddcece7f88?w=400&h=225&fit=crop",
    videoUrl: "https://www.youtube.com/embed/SEfs5TJZ6Nk"
  },
  {
    title: "Медитация на дыхание",
    duration: "12 мин",
    description: "Сосредоточьтесь на дыхании для обретения спокойствия",
    thumbnail: "https://images.unsplash.com/photo-1447452001602-7090c7ab2db3?w=400&h=225&fit=crop",
    videoUrl: "https://www.youtube.com/embed/thekH5T7JTc"
  },
  {
    title: "Медитация благодарности",
    duration: "10 мин",
    description: "Культивируйте чувство благодарности и позитива",
    thumbnail: "https://images.unsplash.com/photo-1499728603263-13726abce5fd?w=400&h=225&fit=crop",
    videoUrl: "https://www.youtube.com/embed/VZ7NwrgHZXk"
  },
  {
    title: "Медитация для уверенности",
    duration: "15 мин",
    description: "Укрепите веру в себя и свои способности",
    thumbnail: "https://images.unsplash.com/photo-1508672019048-805c876b67e2?w=400&h=225&fit=crop",
    videoUrl: "https://www.youtube.com/embed/rBdhqBGqiMc"
  },
];

const Meditations = () => {
  return (
    <div className="min-h-screen bg-calm-gradient">
      <Navigation />
      
      <div className="pt-24 pb-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-4">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-medium">Релаксация</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-3">Медитации</h1>
            <p className="text-muted-foreground text-lg">
              Видео для релаксации, осознанности и внутреннего покоя
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {meditations.map((meditation, index) => (
              <Card
                key={index}
                className="overflow-hidden bg-card border-2 border-border hover:border-primary/30 shadow-soft hover:shadow-medium transition-all group cursor-pointer animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="relative aspect-video overflow-hidden">
                  <img
                    src={meditation.thumbnail}
                    alt={meditation.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-strong">
                      <PlayCircle className="w-10 h-10 text-primary" />
                    </div>
                  </div>
                  <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-black/70 backdrop-blur-sm flex items-center gap-1 text-white text-sm">
                    <Clock className="w-3 h-3" />
                    {meditation.duration}
                  </div>
                </div>

                <div className="p-5">
                  <h3 className="text-xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                    {meditation.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {meditation.description}
                  </p>
                </div>
              </Card>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Card className="p-8 bg-card-gradient border-2 border-primary/20 shadow-medium inline-block">
              <h3 className="text-xl font-bold text-foreground mb-2">Советы для медитации</h3>
              <ul className="text-left text-muted-foreground space-y-2">
                <li>• Найдите тихое и комфортное место</li>
                <li>• Используйте наушники для лучшего эффекта</li>
                <li>• Медитируйте регулярно для достижения результата</li>
                <li>• Не волнуйтесь о "правильной" медитации</li>
              </ul>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Meditations;
