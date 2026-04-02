import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

function App() {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hello! I'm Claw AI Assistant. How can I help you today?" },
  ]);
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim()) return;
    
    setMessages([...messages, { role: "user", content: input }]);
    setInput("");
    
    // Simulate AI response
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "This is a test response. Tauri + shadcn/ui is working!" 
      }]);
    }, 500);
  };

  return (
    <div className="flex h-screen bg-background p-4">
      <Card className="flex flex-col w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl">Claw Desktop</CardTitle>
          <CardDescription>AI Coding Assistant powered by Tauri</CardDescription>
        </CardHeader>
        
        <Separator />
        
        <CardContent className="flex-1 flex flex-col p-4 gap-4">
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="text-sm font-medium mb-1">
                      {msg.role === "user" ? "You" : "Claw AI"}
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="flex gap-2">
            <Textarea
              placeholder="Type your message here..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              className="min-h-[60px] resize-none"
            />
            <Button onClick={handleSend} className="self-end">
              Send
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default App;
