import AsyncStorage from '@react-native-async-storage/async-storage';

const QUESTIONS_KEY = '@chatbot_questions';
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3000';

interface DailyQuestionCount {
  count: number;
  date: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
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

    try {
      const messages: ChatMessage[] = [
        {
          role: 'user',
          content: question,
        },
      ];

      const response = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get response from chatbot');
      }

      const data = await response.json();
      await this.incrementQuestionCount();

      return data.content;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Daily question limit')) {
        throw error;
      }
      console.error('Error calling chatbot API:', error);
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
