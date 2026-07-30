import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { chatbotService } from '@/services/chatbotService';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

export default function ChatbotScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [canAsk, setCanAsk] = useState(true);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadQuestionCount();
    setMessages([
      {
        id: '1',
        text: 'Hello! I\'m here to answer your health-related questions. Remember, I provide educational information only and cannot replace professional medical advice. You have 20 questions available today.',
        sender: 'bot',
        timestamp: new Date(),
      },
    ]);
  }, []);

  const loadQuestionCount = async () => {
    try {
      const count = await chatbotService.getQuestionCountForToday();
      setQuestionCount(count);
      const canAskQuestion = await chatbotService.canAskQuestion();
      setCanAsk(canAskQuestion);
    } catch (error) {
      console.error('Error loading question count:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    if (!canAsk) {
      Alert.alert(
        'Daily Limit Reached',
        'You have reached your daily limit of 20 questions. Please try again tomorrow.'
      );
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setLoading(true);

    try {
      const response = await chatbotService.askHealthQuestion(inputText);

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response,
        sender: 'bot',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, botMessage]);
      await loadQuestionCount();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      Alert.alert('Error', errorMessage);

      setMessages(prev =>
        prev.filter(msg => msg.id !== userMessage.id)
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Health Chatbot</Text>
        <View style={styles.limitBadge}>
          <Text style={styles.limitText}>{questionCount}/20</Text>
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map(message => (
          <View
            key={message.id}
            style={[
              styles.messageWrapper,
              message.sender === 'user' ? styles.userWrapper : styles.botWrapper,
            ]}
          >
            <View
              style={[
                styles.messageBubble,
                message.sender === 'user' ? styles.userMessage : styles.botMessage,
              ]}
            >
              <Text
                style={[
                  styles.messageText,
                  message.sender === 'user' ? styles.userText : styles.botText,
                ]}
              >
                {message.text}
              </Text>
            </View>
          </View>
        ))}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
          </View>
        )}
      </ScrollView>

      {!canAsk && (
        <View style={styles.limitReachedBanner}>
          <Text style={styles.limitReachedText}>
            Daily question limit reached. Come back tomorrow!
          </Text>
        </View>
      )}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Ask a health question..."
          placeholderTextColor="#999"
          value={inputText}
          onChangeText={setInputText}
          editable={!loading && canAsk}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendButton, (!canAsk || loading || !inputText.trim()) && styles.sendButtonDisabled]}
          onPress={handleSendMessage}
          disabled={!canAsk || loading || !inputText.trim()}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#FFF',
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomColor: '#F0F0F0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
  },
  limitBadge: {
    backgroundColor: '#E8F4FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  limitText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  messageWrapper: {
    marginVertical: 8,
    flexDirection: 'row',
  },
  userWrapper: {
    justifyContent: 'flex-end',
  },
  botWrapper: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  userMessage: {
    backgroundColor: '#007AFF',
  },
  botMessage: {
    backgroundColor: '#E9E9EB',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  userText: {
    color: '#FFF',
  },
  botText: {
    color: '#000',
  },
  loadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  limitReachedBanner: {
    backgroundColor: '#FFE5E5',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  limitReachedText: {
    fontSize: 14,
    color: '#D32F2F',
    fontWeight: '500',
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderTopColor: '#F0F0F0',
    borderTopWidth: 1,
    gap: 8,
  },
  input: {
    flex: 1,
    borderColor: '#DDD',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    color: '#000',
  },
  sendButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  sendButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 15,
  },
});
