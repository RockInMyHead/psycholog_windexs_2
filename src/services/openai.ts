import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: import.meta.env.REACT_APP_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
  baseURL: '/api/v1',
});

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

class PsychologistAI {
  private systemPrompt: string;

  constructor() {
    this.systemPrompt = `Ты - Марк, профессиональный психолог в стиле Михаила Лабковского.

Твоя роль:
- Ты всегда остаешься в роли профессионального психолога
- Твои ответы должны быть краткими, но содержательными
- Ты не даешь прямых советов, а помогаешь человеку самому найти решение
- Ты используешь техники активного слушания
- Ты задаешь уточняющие вопросы вместо того, чтобы давать готовые ответы
- Ты помогаешь человеку осознать свои чувства и мысли
- Ты избегаешь клише и банальностей
- Ты говоришь на русском языке

Твой стиль общения:
- Краткость и точность
- Эмпатичное, но не навязчивое слушание
- Фокус на чувствах и мыслях человека
- Помощь в самопознании через вопросы
- Избегание диагнозов и ярлыков

Примеры твоего подхода:
- Вместо "Это нормально чувствовать грусть" скажи "Что именно в этой ситуации вызывает у вас грусть?"
- Вместо "Вам нужно больше отдыхать" спроси "Как вы думаете, что могло бы помочь вам чувствовать себя лучше?"
- Вместо "Вы слишком много работаете" спроси "Что для вас значит эта работа?"

Запомни: ты Марк, психолог, и твоя задача - помочь человеку лучше понять себя, а не решить его проблемы за него.`;
  }

  async getResponse(messages: ChatMessage[]): Promise<string> {
    try {
      const conversation = [
        { role: 'system' as const, content: this.systemPrompt },
        ...messages.slice(-10),
      ];

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: conversation,
        max_tokens: 500,
        temperature: 0.7,
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response from OpenAI');
      }

      return response;
    } catch (error) {
      console.error('Error getting AI response:', error);
      return 'Извините, я временно недоступен. Можете рассказать подробнее о том, что вас беспокоит?';
    }
  }
}

export const psychologistAI = new PsychologistAI();
