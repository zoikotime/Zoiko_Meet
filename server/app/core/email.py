"""Email service for sending meeting invites and notifications."""
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders

from app.core.config import get_settings

log = logging.getLogger(__name__)


def _smtp_connection():
    """Open an SMTP connection using settings."""
    s = get_settings()
    if s.smtp_use_tls:
        server = smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=15)
        server.starttls()
    else:
        server = smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=15)
    server.login(s.smtp_user, s.smtp_password)
    return server


def send_email(to: str, subject: str, html_body: str, attachments: list[tuple[str, bytes, str]] | None = None) -> bool:
    """Send an email. attachments is a list of (filename, data, mime_type).
    Returns True on success, False on failure (never raises)."""
    s = get_settings()
    if not s.smtp_enabled:
        log.warning("SMTP not configured — skipping email to %s", to)
        return False

    msg = MIMEMultipart()
    msg["From"] = f"{s.smtp_from_name} <{s.smtp_from_email}>"
    msg["To"] = to
    msg["Subject"] = subject
    msg.attach(MIMEText(html_body, "html"))

    if attachments:
        for filename, data, mime_type in attachments:
            part = MIMEBase(*mime_type.split("/", 1))
            part.set_payload(data)
            encoders.encode_base64(part)
            part.add_header("Content-Disposition", f'attachment; filename="{filename}"')
            msg.attach(part)

    try:
        server = _smtp_connection()
        server.sendmail(s.smtp_from_email, to, msg.as_string())
        server.quit()
        return True
    except Exception:
        log.exception("Failed to send email to %s", to)
        return False


def send_meeting_invite_email(
    to_email: str,
    inviter_name: str,
    meeting_title: str,
    meeting_code: str,
    join_url: str,
    scheduled_at: str | None = None,
    ics_data: bytes | None = None,
) -> bool:
    """Send a meeting invite email with optional .ics attachment."""
    schedule_line = ""
    if scheduled_at:
        schedule_line = f'<p style="color:#888;font-size:14px;">Scheduled for: <strong>{scheduled_at}</strong></p>'

    html = f"""
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#0d0f17;color:#e8e9ed;border-radius:16px;">
        <div style="text-align:center;margin-bottom:24px;">
            <div style="display:inline-block;width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#7c8cff,#ff7bd9);color:#fff;font-size:24px;font-weight:700;line-height:48px;">Z</div>
        </div>
        <h2 style="text-align:center;font-size:22px;margin:0 0 8px;">You're invited to a meeting</h2>
        <p style="text-align:center;color:#888;font-size:14px;margin:0 0 24px;">{inviter_name} invited you to join</p>
        <div style="background:#161825;border:1px solid #2a2d3e;border-radius:12px;padding:20px;margin-bottom:24px;">
            <h3 style="margin:0 0 8px;font-size:18px;">{meeting_title}</h3>
            <p style="color:#7c8cff;font-size:14px;font-family:monospace;margin:0 0 4px;">{meeting_code}</p>
            {schedule_line}
        </div>
        <div style="text-align:center;">
            <a href="{join_url}" style="display:inline-block;background:linear-gradient(135deg,#7c8cff,#ff7bd9);color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;font-size:15px;">Join Meeting</a>
        </div>
        <p style="text-align:center;color:#555;font-size:12px;margin-top:24px;">Zoiko connect &mdash; Secure video meetings for everyone</p>
    </div>
    """

    attachments = []
    if ics_data:
        attachments.append(("meeting.ics", ics_data, "text/calendar"))

    return send_email(to_email, f"Meeting invite: {meeting_title}", html, attachments)


def send_meeting_reminder_email(
    to_email: str,
    meeting_title: str,
    meeting_code: str,
    join_url: str,
    scheduled_at: str,
    minutes_until: int,
) -> bool:
    """Send a meeting reminder email."""
    html = f"""
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#0d0f17;color:#e8e9ed;border-radius:16px;">
        <div style="text-align:center;margin-bottom:24px;">
            <div style="display:inline-block;width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#7c8cff,#ff7bd9);color:#fff;font-size:24px;font-weight:700;line-height:48px;">Z</div>
        </div>
        <h2 style="text-align:center;font-size:22px;margin:0 0 8px;">Meeting starting soon</h2>
        <p style="text-align:center;color:#fbbf24;font-size:14px;margin:0 0 24px;">Starting in {minutes_until} minute{'s' if minutes_until != 1 else ''}</p>
        <div style="background:#161825;border:1px solid #2a2d3e;border-radius:12px;padding:20px;margin-bottom:24px;">
            <h3 style="margin:0 0 8px;font-size:18px;">{meeting_title}</h3>
            <p style="color:#888;font-size:14px;margin:0;">{scheduled_at}</p>
        </div>
        <div style="text-align:center;">
            <a href="{join_url}" style="display:inline-block;background:linear-gradient(135deg,#7c8cff,#ff7bd9);color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;font-size:15px;">Join Meeting</a>
        </div>
    </div>
    """
    return send_email(to_email, f"Reminder: {meeting_title} in {minutes_until}min", html)
