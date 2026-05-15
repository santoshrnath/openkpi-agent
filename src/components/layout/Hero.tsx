import { Sparkles } from "lucide-react";
import styles from "./Hero.module.css";

interface Props {
  kicker?: string;
  title: string | React.ReactNode;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function Hero({ kicker, title, subtitle, actions }: Props) {
  return (
    <div className={styles.hero}>
      <div>
        {kicker && (
          <div className={styles.kicker}>
            <Sparkles size={12} />
            {kicker}
          </div>
        )}
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <p className={styles.sub}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
