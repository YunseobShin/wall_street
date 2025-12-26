import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from typing import Optional
from datetime import datetime
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

from models.briefing import Briefing

load_dotenv()


class EmailServiceError(Exception):
    """이메일 서비스 에러"""
    pass


class EmailService:
    """이메일 발송 서비스 (Gmail SMTP)"""

    def __init__(self):
        self.smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.sender_email = os.getenv("SMTP_EMAIL")
        self.sender_password = os.getenv("SMTP_PASSWORD")
        self.default_recipient = os.getenv("DEFAULT_RECIPIENT", "skwi2004@gmail.com")

    def send_briefing(
        self,
        briefing: Briefing,
        recipient: Optional[str] = None,
    ) -> dict:
        """
        브리핑 이메일 발송

        Args:
            briefing: 발송할 브리핑 객체
            recipient: 수신자 이메일 (미지정 시 기본값 사용)

        Returns:
            발송 결과 dict
        """
        if not self.sender_email or not self.sender_password:
            raise EmailServiceError(
                "SMTP_EMAIL, SMTP_PASSWORD 환경변수가 설정되지 않았습니다."
            )

        to_email = recipient or self.default_recipient
        now_kst = datetime.now(ZoneInfo("Asia/Seoul"))

        # 이메일 제목
        subject = f"[당신이 잠든 사이] {briefing.date} 미국주식 브리핑 - {briefing.top1_symbol}"

        # HTML 본문 생성
        html_body = self._create_html_body(briefing)

        # 이메일 메시지 구성
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"당신이 잠든 사이 <{self.sender_email}>"
        msg["To"] = to_email

        # 텍스트 버전 (폴백)
        text_part = MIMEText(self._create_text_body(briefing), "plain", "utf-8")
        html_part = MIMEText(html_body, "html", "utf-8")

        msg.attach(text_part)
        msg.attach(html_part)

        try:
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.sender_email, self.sender_password)
                server.sendmail(self.sender_email, to_email, msg.as_string())

            return {
                "success": True,
                "recipient": to_email,
                "subject": subject,
                "sent_at": now_kst.isoformat(),
            }

        except smtplib.SMTPAuthenticationError as e:
            raise EmailServiceError(f"SMTP 인증 실패: {str(e)}") from e
        except smtplib.SMTPException as e:
            raise EmailServiceError(f"이메일 발송 실패: {str(e)}") from e
        except Exception as e:
            raise EmailServiceError(f"이메일 발송 중 오류: {str(e)}") from e

    def _create_html_body(self, briefing: Briefing) -> str:
        """HTML 이메일 본문 생성"""
        # 변동률 색상
        top1_item = briefing.items[0] if briefing.items else None
        change_pct = top1_item.regular_market_change_percent if top1_item else 0
        color = "#10b981" if change_pct >= 0 else "#f43f5e"
        arrow = "↑" if change_pct >= 0 else "↓"

        # 종목 테이블 생성
        items_html = ""
        for item in briefing.items[:5]:
            pct = item.regular_market_change_percent
            pct_color = "#10b981" if pct >= 0 else "#f43f5e"
            items_html += f"""
            <tr>
                <td style="padding: 12px; border-bottom: 1px solid #333;">
                    <strong>{item.symbol}</strong><br>
                    <span style="color: #888; font-size: 13px;">{item.short_name}</span>
                </td>
                <td style="padding: 12px; border-bottom: 1px solid #333; text-align: right;">
                    ${item.regular_market_price:.2f}
                </td>
                <td style="padding: 12px; border-bottom: 1px solid #333; text-align: right; color: {pct_color};">
                    {pct:+.2f}%
                </td>
            </tr>
            """

        return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f1a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <!-- 헤더 -->
        <div style="text-align: center; margin-bottom: 40px;">
            <h1 style="color: #f5f0e6; font-size: 28px; margin: 0;">당신이 잠든 사이</h1>
            <p style="color: #8b8680; font-size: 14px; margin-top: 8px;">
                {briefing.date} 미국주식 브리핑
            </p>
        </div>

        <!-- TOP 1 카드 -->
        <div style="background: linear-gradient(135deg, #111b33, #1a2744); border-radius: 16px; padding: 32px; margin-bottom: 24px; text-align: center;">
            <p style="color: #d4a574; font-size: 14px; margin: 0 0 16px 0;">오늘의 화제 종목</p>
            <h2 style="color: #f5f0e6; font-size: 48px; margin: 0;">{briefing.top1_symbol}</h2>
            <p style="color: {color}; font-size: 36px; font-weight: bold; margin: 16px 0;">
                {arrow} {abs(change_pct):.2f}%
            </p>
            <p style="color: #8b8680; font-size: 14px; margin: 0;">
                {briefing.criteria_label}
            </p>
        </div>

        <!-- 요약 -->
        <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 24px; margin-bottom: 24px;">
            <h3 style="color: #d4a574; font-size: 16px; margin: 0 0 12px 0;">요약</h3>
            <p style="color: #f5f0e6; font-size: 15px; line-height: 1.6; margin: 0;">
                {briefing.summary_text}
            </p>
        </div>

        <!-- 종목 테이블 -->
        <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 24px; margin-bottom: 24px;">
            <h3 style="color: #d4a574; font-size: 16px; margin: 0 0 16px 0;">오늘의 화제 종목</h3>
            <table style="width: 100%; border-collapse: collapse; color: #f5f0e6;">
                <thead>
                    <tr style="color: #8b8680; font-size: 13px;">
                        <th style="text-align: left; padding: 8px 12px;">종목</th>
                        <th style="text-align: right; padding: 8px 12px;">가격</th>
                        <th style="text-align: right; padding: 8px 12px;">변동</th>
                    </tr>
                </thead>
                <tbody>
                    {items_html}
                </tbody>
            </table>
        </div>

        <!-- 푸터 -->
        <div style="text-align: center; margin-top: 40px; padding-top: 24px; border-top: 1px solid #333;">
            <p style="color: #8b8680; font-size: 12px; margin: 0;">
                Powered by Gemini AI | 투자 권유가 아닌 정보 제공 목적입니다.
            </p>
        </div>
    </div>
</body>
</html>
        """

    def _create_text_body(self, briefing: Briefing) -> str:
        """텍스트 이메일 본문 생성 (폴백)"""
        lines = [
            f"[당신이 잠든 사이] {briefing.date} 미국주식 브리핑",
            "",
            f"오늘의 화제 종목: {briefing.top1_symbol}",
            f"선정 이유: {briefing.criteria_label}",
            "",
            "=== 요약 ===",
            briefing.summary_text,
            "",
            "=== 화제 종목 ===",
        ]

        for item in briefing.items[:5]:
            lines.append(
                f"- {item.symbol} ({item.short_name}): "
                f"${item.regular_market_price:.2f} ({item.regular_market_change_percent:+.2f}%)"
            )

        lines.extend([
            "",
            "---",
            "Powered by Gemini AI",
            "투자 권유가 아닌 정보 제공 목적입니다.",
        ])

        return "\n".join(lines)
