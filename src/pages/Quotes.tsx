import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lightbulb, Heart, Sparkles } from "lucide-react";
import Navigation from "@/components/Navigation";
import { userApi, quoteApi } from "@/services/api";

const Quotes = () => {
  const [quotes, setQuotes] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userQuoteViews, setUserQuoteViews] = useState<Map<string, boolean>>(new Map());
  const [showLikedOnly, setShowLikedOnly] = useState(false);
  const [likedQuotes, setLikedQuotes] = useState<any[]>([]);

  // Default user ID for demo purposes
  const defaultUserId = 'user@zenmindmate.com';

  useEffect(() => {
    initializeData();
  }, []);

  const initializeData = async () => {
    try {
      setLoading(true);

      // Get or create user
      const userData = await userApi.getOrCreateUser(defaultUserId, 'Пользователь');
      setUser(userData);

      // Load quotes
      const quotesData = await quoteApi.getAllQuotes();
      // Filter out quotes with invalid IDs
      const validQuotes = quotesData.filter(quote => quote.id && typeof quote.id === 'string');
      console.log('Loaded quotes:', validQuotes.length, 'valid out of', quotesData.length, 'total');
      setQuotes(validQuotes);

      // Load user's quote views
      const views = await quoteApi.getUserQuoteViews(userData.id, 50);
      const viewsMap = new Map<string, boolean>();
      views.forEach(view => {
        viewsMap.set(view.quote.id, view.view.liked === 1);
      });
      setUserQuoteViews(viewsMap);

      // Load liked quotes
      const liked = await quoteApi.getUserLikedQuotes(userData.id, 50);
      const validLikedQuotes = liked
        .map(item => item.quote)
        .filter(quote => quote.id && typeof quote.id === 'string');
      setLikedQuotes(validLikedQuotes);

    } catch (error) {
      console.error('Error loading quotes data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuoteClick = async (quoteId: string) => {
    if (!user || !quoteId) {
      console.error('Invalid user or quoteId:', { user: !!user, quoteId });
      return;
    }

    try {
      // Toggle like status using the new service method
      await quoteApi.toggleQuoteLike(user.id, quoteId);

      // Update local state
      const currentlyLiked = userQuoteViews.get(quoteId) || false;
      setUserQuoteViews(prev => new Map(prev.set(quoteId, !currentlyLiked)));

      // Update liked quotes list
      const quote = quotes.find(q => q.id === quoteId);
      if (!quote) {
        console.error('Quote not found in quotes array:', quoteId);
        return;
      }

      if (!currentlyLiked) {
        // Just liked - add to liked quotes
        setLikedQuotes(prev => [quote, ...prev]);
      } else {
        // Just unliked - remove from liked quotes
        setLikedQuotes(prev => prev.filter(q => q.id !== quoteId));
      }

    } catch (error) {
      console.error('Error handling quote interaction:', error);
    }
  };

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

          {/* Filter Buttons */}
          <div className="flex justify-center gap-4 mb-8">
            <Button
              onClick={() => setShowLikedOnly(false)}
              variant={!showLikedOnly ? "default" : "outline"}
              className={!showLikedOnly ? "bg-hero-gradient text-white hover:shadow-lg" : ""}
            >
              <Lightbulb className="w-4 h-4 mr-2" />
              Все цитаты ({quotes.length})
            </Button>
            <Button
              onClick={() => setShowLikedOnly(true)}
              variant={showLikedOnly ? "default" : "outline"}
              className={showLikedOnly ? "bg-hero-gradient text-white hover:shadow-lg" : ""}
            >
              <Heart className="w-4 h-4 mr-2" />
              Понравившиеся ({likedQuotes.length})
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
              <div className="col-span-full text-center py-12">
                <Lightbulb className="w-12 h-12 mx-auto mb-4 text-primary animate-pulse" />
                <p className="text-muted-foreground">Загрузка цитат...</p>
              </div>
            ) : (showLikedOnly ? likedQuotes : quotes).length === 0 ? (
              <div className="col-span-full text-center py-12">
                <Heart className="w-12 h-12 mx-auto mb-4 text-primary" />
                <p className="text-muted-foreground">
                  {showLikedOnly ? "У вас пока нет понравившихся цитат" : "Цитаты не найдены"}
                </p>
              </div>
            ) : (
              (showLikedOnly ? likedQuotes : quotes).map((quote, index) => {
                const isLiked = userQuoteViews.get(quote.id) || false;
                return (
                  <Card
                    key={`${showLikedOnly ? 'liked' : 'all'}-${quote.id}-${index}`}
                    className="p-6 bg-card-gradient border-2 border-border hover:border-primary/30 shadow-soft hover:shadow-medium transition-all cursor-pointer group animate-fade-in"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform shadow-medium">
                        <Lightbulb className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1 flex justify-between items-start">
                        <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                          {quote.category}
                        </span>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuoteClick(quote.id);
                          }}
                          variant="ghost"
                          size="sm"
                          className={`p-1 h-auto ${isLiked ? 'text-red-500' : 'text-muted-foreground hover:text-red-500'}`}
                        >
                          <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                        </Button>
                      </div>
                    </div>

                    <p className="text-foreground text-lg leading-relaxed mb-4 italic">
                      "{quote.text}"
                    </p>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground pt-4 border-t border-border">
                      <span className="font-medium">{quote.author}</span>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Quotes;