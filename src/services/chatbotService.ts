import AsyncStorage from '@react-native-async-storage/async-storage';
import { Anthropic } from '@anthropic-ai/sdk';

const QUESTIONS_KEY = '@chatbot_questions';
const API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;

interface DailyQuestionCount {
  count: number;
  date: string;
}

export const chatbotService = {
  async getQuestionCountForToday(): Promise<number> {
    try {
      const data = await AsyncStorage.getItem(QUESTIONS_KEY);
      if (!data) return 0;

      const parsed: DailyQuestionCount = JSON.parse(data);
      const today = new Date().toISOString().split('T')[0];

      if (parsed.date === today) {
        return parsed.count;
      }
      return 0;
    } catch (error) {
      console.error('Error getting question count:', error);
      return 0;
    }
  },

  async incrementQuestionCount(): Promise<void> {
    try {
      const currentCount = await this.getQuestionCountForToday();
      const today = new Date().toISOString().split('T')[0];

      const data: DailyQuestionCount = {
        count: currentCount + 1,
        date: today,
      };

      await AsyncStorage.setItem(QUESTIONS_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Error incrementing question count:', error);
      throw error;
    }
  },

  async canAskQuestion(): Promise<boolean> {
    const count = await this.getQuestionCountForToday();
    return count < 20;
  },

  async askHealthQuestion(question: string): Promise<string> {
    const count = await this.getQuestionCountForToday();
    if (count >= 20) {
      throw new Error('Daily question limit (20) has been reached. Please try again tomorrow.');
    }

    if (!API_KEY) {
      throw new Error('API key not configured');
    }

    try {
      const client = new Anthropic({
        apiKey: API_KEY,
        dangerouslyAllowBrowser: true,
      });

      const message = await client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        system: `You are a helpful health information assistant. Provide accurate, evidence-based health information to answer patient questions.

IMPORTANT:
- You provide educational health information only, not medical diagnosis or treatment advice
- Always recommend consulting with a healthcare provider for medical concerns
- Be clear about the limitations of AI-based health information
- Do not replace professional medical advice`,
        messages: [
          {
            role: 'user',
            content: question,
          },
        ],
      });

      await this.incrementQuestionCount();

      const content = message.content[0];
      if (content.type === 'text') {
        return content.text;
      }

      throw new Error('Unexpected response format from Claude');
    } catch (error) {
      if (error instanceof Error && error.message.includes('Daily question limit')) {
        throw error;
      }
      console.error('Error calling Claude API:', error);
      throw new Error('Failed to get response from chatbot. Please try again.');
    }
  },

  async resetDailyCount(): Promise<void> {
    try {
      await AsyncStorage.removeItem(QUESTIONS_KEY);
    } catch (error) {
      console.error('Error resetting question count:', error);
      throw error;
    }
  },
};
