import { Card } from "@/components/ui/card";
import { Lightbulb, Heart, Sparkles } from "lucide-react";
import Navigation from "@/components/Navigation";

const quotes = [
  {
    text: "Единственный способ сделать что-то хорошо — полюбить то, что вы делаете.",
    author: "Стив Джобс",
    category: "Мотивация"
  },
  {
    text: "Жизнь — это то, что происходит с вами, пока вы строите другие планы.",
    author: "Джон Леннон",
    category: "Жизнь"
  },
  {
    text: "Путь в тысячу миль начинается с первого шага.",
    author: "Лао-цзы",
    category: "Начинания"
  },
  {
    text: "Не важно, как медленно вы идете, главное — не останавливаться.",
    author: "Конфуций",
    category: "Настойчивость"
  },
  {
    text: "Счастье — это не цель, а способ жить.",
    author: "Далай-лама",
    category: "Счастье"
  },
  {
    text: "Будьте тем изменением, которое хотите видеть в мире.",
    author: "Махатма Ганди",
    category: "Вдохновение"
  },
  {
    text: "Лучшее время посадить дерево было 20 лет назад. Второе лучшее время — сейчас.",
    author: "Китайская пословица",
    category: "Действие"
  },
  {
    text: "Успех — это способность идти от неудачи к неудаче, не теряя энтузиазма.",
    author: "Уинстон Черчилль",
    category: "Успех"
  },
  {
    text: "Ваше время ограничено, не тратьте его на жизнь чужой жизнью.",
    author: "Стив Джобс",
    category: "Аутентичность"
  },
  {
    text: "Единственная невозможная вещь — это та, которую вы не попытались сделать.",
    author: "Неизвестный автор",
    category: "Возможности"
  },
  {
    text: "Падать — это нормально. Подниматься — обязательно.",
    author: "Конфуций",
    category: "Стойкость"
  },
  {
    text: "Мудрость приходит с опытом, а опыт — с ошибками.",
    author: "Оскар Уайльд",
    category: "Мудрость"
  },
];

const Quotes = () => {
  return (
    <div className="min-h-screen bg-calm-gradient">
      <Navigation />
      
      <div className="pt-24 pb-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-4">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-medium">Вдохновение</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-3">Мудрые фразы</h1>
            <p className="text-muted-foreground text-lg">
              Коллекция вдохновляющих мыслей великих людей
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {quotes.map((quote, index) => (
              <Card
                key={index}
                className="p-6 bg-card-gradient border-2 border-border hover:border-primary/30 shadow-soft hover:shadow-medium transition-all cursor-pointer group animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform shadow-medium">
                    <Lightbulb className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                      {quote.category}
                    </span>
                  </div>
                </div>

                <p className="text-foreground text-lg leading-relaxed mb-4 italic">
                  "{quote.text}"
                </p>

                <div className="flex items-center gap-2 text-sm text-muted-foreground pt-4 border-t border-border">
                  <Heart className="w-4 h-4 text-accent" />
                  <span className="font-medium">{quote.author}</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Quotes;
