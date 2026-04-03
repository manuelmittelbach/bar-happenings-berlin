export interface Question {
  id: string;
  author: string;
  text: string;
  date: string;
  replies: { author: string; text: string; date: string; isVenue?: boolean }[];
}
import { MessageCircle } from "lucide-react";

interface QuestionThreadProps {
  questions: Question[];
}

export default function QuestionThread({ questions }: QuestionThreadProps) {
  return (
    <div className="space-y-6">
      <h3 className="font-heading text-lg font-semibold flex items-center gap-2">
        <MessageCircle className="h-5 w-5" />
        Questions & Discussion
      </h3>
      {questions.map((q) => (
        <div key={q.id} className="border border-border rounded-sm p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-sm font-semibold">{q.author}</span>
              <span className="text-xs text-muted-foreground ml-2">{q.date}</span>
            </div>
          </div>
          <p className="text-sm leading-relaxed">{q.text}</p>
          {q.replies.map((r, i) => (
            <div key={i} className="ml-4 pl-4 border-l-2 border-border space-y-1">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-semibold ${r.isVenue ? "text-accent" : ""}`}>
                  {r.author}
                  {r.isVenue && (
                    <span className="ml-1.5 text-xs bg-accent/10 text-accent px-1.5 py-0.5 rounded-sm">
                      Venue
                    </span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">{r.date}</span>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{r.text}</p>
            </div>
          ))}
        </div>
      ))}
      <div className="border border-border rounded-sm p-4">
        <textarea
          placeholder="Ask a question about this event..."
          className="w-full bg-transparent text-sm resize-none outline-none placeholder:text-muted-foreground min-h-[60px]"
        />
        <div className="flex justify-end mt-2">
          <button className="h-8 px-4 text-sm font-medium bg-foreground text-background rounded-sm hover:bg-foreground/90 transition-colors">
            Post
          </button>
        </div>
      </div>
    </div>
  );
}
