import React from 'react';
import { BookOpen, Mic, Lightbulb, CheckCircle2, Edit3, Star } from 'lucide-react';
import './MarkdownRenderer.css';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Parses inline text tokens (bold, italic, bold-italic, code, links, blanks)
 */
export const renderWebInlineText = (
  text: string,
  keyPrefix: string = 'inline'
): React.ReactNode[] => {
  if (!text) return [];

  const tokenRegex = /(\[[^\]]+\]\([^)]+\)|\*\*\*[^*]+\*\*\*|___[^_]+___|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|`[^`]+`|_{3,})/g;

  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.substring(lastIdx, match.index));
    }

    const token = match[0];
    const tokenKey = `${keyPrefix}-tok-${match.index}`;

    if (token.startsWith('[') && token.includes('](') && token.endsWith(')')) {
      const labelMatch = token.match(/\[([^\]]+)\]/);
      const urlMatch = token.match(/\(([^)]+)\)/);
      const label = labelMatch ? labelMatch[1] : token;
      const url = urlMatch ? urlMatch[1] : '#';

      parts.push(
        <a
          key={tokenKey}
          href={url.startsWith('http') ? url : `https://${url}`}
          target="_blank"
          rel="noreferrer"
          className="md-link"
        >
          {label}
        </a>
      );
    } else if ((token.startsWith('***') && token.endsWith('***')) || (token.startsWith('___') && token.endsWith('___') && token.length > 6)) {
      const inner = token.slice(3, -3);
      parts.push(
        <strong key={tokenKey} className="md-bold-italic">
          {inner}
        </strong>
      );
    } else if ((token.startsWith('**') && token.endsWith('**')) || (token.startsWith('__') && token.endsWith('__'))) {
      const inner = token.slice(2, -2);
      parts.push(
        <strong key={tokenKey} className="md-bold">
          {inner}
        </strong>
      );
    } else if ((token.startsWith('*') && token.endsWith('*')) || (token.startsWith('_') && token.endsWith('_') && !token.startsWith('___'))) {
      const inner = token.slice(1, -1);
      parts.push(
        <em key={tokenKey} className="md-italic">
          {inner}
        </em>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      const inner = token.slice(1, -1);
      parts.push(
        <code key={tokenKey} className="md-code">
          {inner}
        </code>
      );
    } else if (/^_{3,}$/.test(token)) {
      parts.push(
        <span key={tokenKey} className="md-blank">
          {' ' + '＿'.repeat(Math.min(Math.max(Math.floor(token.length / 2), 4), 20)) + ' '}
        </span>
      );
    } else {
      parts.push(token);
    }

    lastIdx = tokenRegex.lastIndex;
  }

  if (lastIdx < text.length) {
    parts.push(text.substring(lastIdx));
  }

  return parts;
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  if (!content || typeof content !== 'string') return null;

  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const renderedElements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    const lineKey = `md-wline-${i}`;

    if (!line) {
      renderedElements.push(<div key={lineKey} className="md-empty-line" />);
      continue;
    }

    // 1. Horizontal Divider
    if (/^([-*_]){3,}$/.test(line)) {
      renderedElements.push(
        <div key={lineKey} className="md-divider">
          <div className="md-divider-diamond" />
        </div>
      );
      continue;
    }

    // 2. Headings
    // H1 Heading (# Heading)
    if (/^#\s+(.+)$/.test(line)) {
      const match = line.match(/^#\s+(.+)$/);
      const headingText = match ? match[1].trim() : '';

      const isSpeaking = /speaking\s*practice/i.test(headingText);
      const isRule = /important\s*rule|rule|grammar\s*rule|formula/i.test(headingText);

      renderedElements.push(
        <div
          key={lineKey}
          className={`md-h1 ${isSpeaking ? 'md-speaking-header' : ''} ${isRule ? 'md-rule-header' : ''}`}
        >
          {isSpeaking ? (
            <Mic size={20} className="text-sky-600" />
          ) : isRule ? (
            <Lightbulb size={20} className="text-amber-600" />
          ) : (
            <BookOpen size={20} className="text-rose-600" />
          )}
          <span>{renderWebInlineText(headingText, `${lineKey}-h1`)}</span>
        </div>
      );
      continue;
    }

    // H2 Heading (## Heading)
    if (/^##\s+(.+)$/.test(line)) {
      const match = line.match(/^##\s+(.+)$/);
      const headingText = match ? match[1].trim() : '';
      const isPart = /part\s+[a-z0-9]/i.test(headingText);

      renderedElements.push(
        <div key={lineKey} className={`md-h2 ${isPart ? 'md-part-header' : ''}`}>
          {isPart && (
            <span className="md-part-badge">
              <CheckCircle2 size={12} style={{ display: 'inline', marginRight: '3px' }} />
              Section
            </span>
          )}
          <span>{renderWebInlineText(headingText, `${lineKey}-h2`)}</span>
        </div>
      );
      continue;
    }

    // H3 Heading (### Heading)
    if (/^###\s+(.+)$/.test(line)) {
      const match = line.match(/^###\s+(.+)$/);
      const headingText = match ? match[1].trim() : '';

      renderedElements.push(
        <div key={lineKey} className="md-h3">
          {renderWebInlineText(headingText, `${lineKey}-h3`)}
        </div>
      );
      continue;
    }

    // H4 Heading (#### Heading)
    if (/^####+\s+(.+)$/.test(line)) {
      const match = line.match(/^####+\s+(.+)$/);
      const headingText = match ? match[1].trim() : '';

      renderedElements.push(
        <div key={lineKey} className="md-h4">
          {renderWebInlineText(headingText, `${lineKey}-h4`)}
        </div>
      );
      continue;
    }

    // 3. Marks Badge: e.g. **(5 Marks – 1 mark each)**
    if (/^\*\*\(\s*\d+\s*Marks.*?\)\*\*$/i.test(line) || /^\(\s*\d+\s*Marks.*?\)$/i.test(line)) {
      const cleanText = line.replace(/\*\*/g, '').trim();
      renderedElements.push(
        <div key={lineKey} className="md-marks-badge">
          <Star size={13} />
          <span>{cleanText}</span>
        </div>
      );
      continue;
    }

    // 4. Numbered Questions / List items (e.g. "1. I __________ ...")
    const numberedMatch = line.match(/^(\d+)[\.\)]\s+(.+)$/);
    if (numberedMatch) {
      const num = numberedMatch[1];
      const itemContent = numberedMatch[2];

      renderedElements.push(
        <div key={lineKey} className="md-numbered-item">
          <div className="md-number-badge">{num}</div>
          <div className="md-item-content">
            {renderWebInlineText(itemContent, `${lineKey}-num`)}
          </div>
        </div>
      );
      continue;
    }

    // 5. Multiple Choice Options (e.g. "A. She have finished...")
    const optionMatch = line.match(/^([A-D|a-d])[\.\)]\s+(.+)$/);
    if (optionMatch) {
      const optionLetter = optionMatch[1].toUpperCase();
      const optionContent = optionMatch[2];

      renderedElements.push(
        <div key={lineKey} className="md-choice-option">
          <div className="md-choice-letter">{optionLetter}</div>
          <div className="md-item-content">
            {renderWebInlineText(optionContent, `${lineKey}-opt`)}
          </div>
        </div>
      );
      continue;
    }

    // 6. Answer / Correct Blank Prompt Line (e.g. "**Answer:** ___________________")
    if (/^\s*\*\*(Answer|Correct|उत्तर):\*\*/i.test(line) || /^(Answer|Correct|उत्तर):/i.test(line)) {
      renderedElements.push(
        <div key={lineKey} className="md-answer-box">
          <Edit3 size={14} className="text-indigo-500 shrink-0" />
          <div>{renderWebInlineText(line, `${lineKey}-ans`)}</div>
        </div>
      );
      continue;
    }

    // 7. Bullet items (- item, * item, • item)
    const bulletMatch = line.match(/^[-*•]\s+(.+)$/);
    if (bulletMatch) {
      const bulletContent = bulletMatch[1];
      renderedElements.push(
        <div key={lineKey} className="md-bullet-item">
          <div className="md-bullet-dot" />
          <div className="md-item-content">
            {renderWebInlineText(bulletContent, `${lineKey}-bul`)}
          </div>
        </div>
      );
      continue;
    }

    // 8. Blockquote / Callout (> text)
    const quoteMatch = line.match(/^>\s*(.+)$/);
    if (quoteMatch) {
      const quoteContent = quoteMatch[1];
      renderedElements.push(
        <div key={lineKey} className="md-quote">
          {renderWebInlineText(quoteContent, `${lineKey}-quo`)}
        </div>
      );
      continue;
    }

    // 9. Key-Value Row (e.g. "**Student Name:** ____________________")
    if (/^\*\*[^*]+:\*\*/.test(line)) {
      renderedElements.push(
        <div key={lineKey} className="md-meta-row">
          {renderWebInlineText(line, `${lineKey}-meta`)}
        </div>
      );
      continue;
    }

    // 10. Default Paragraph
    renderedElements.push(
      <div key={lineKey} className="md-paragraph">
        {renderWebInlineText(line, `${lineKey}-p`)}
      </div>
    );
  }

  return <div className={`md-renderer ${className}`}>{renderedElements}</div>;
};

export default MarkdownRenderer;
