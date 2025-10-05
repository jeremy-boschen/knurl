use chrono::{DateTime, NaiveDateTime, Utc};

use crate::http_client::response::Cookie;

/// Parse a single `Set-Cookie` header value into a [`Cookie`] struct.
/// Only standard attributes are extracted; unknown attributes are ignored.
pub(crate) fn parse_set_cookie_header(header_value: &str) -> Option<Cookie> {
    let mut segments = header_value.split(';');
    let first = segments.next()?.trim();

    let mut nv_iter = first.splitn(2, '=');
    let name = nv_iter.next()?.trim();
    let value = nv_iter.next().unwrap_or("").trim();
    if name.is_empty() {
        return None;
    }

    let mut cookie = Cookie {
        name: name.to_string(),
        value: value.to_string(),
        domain: None,
        path: None,
        expires: None,
        max_age: None,
        secure: None,
        http_only: None,
        same_site: None,
    };

    for segment in segments {
        let seg = segment.trim();
        if seg.is_empty() {
            continue;
        }
        if seg.eq_ignore_ascii_case("secure") {
            cookie.secure = Some(true);
            continue;
        }
        if seg.eq_ignore_ascii_case("httponly") {
            cookie.http_only = Some(true);
            continue;
        }
        if let Some(eq_pos) = seg.find('=') {
            let key = seg[..eq_pos].trim();
            let val = seg[eq_pos + 1..].trim();
            if key.is_empty() {
                continue;
            }
            match key.to_ascii_lowercase().as_str() {
                "domain" => {
                    if !val.is_empty() {
                        cookie.domain = Some(val.to_string());
                    }
                }
                "path" => {
                    if !val.is_empty() {
                        cookie.path = Some(val.to_string());
                    }
                }
                "expires" => {
                    if !val.is_empty()
                        && let Some(dt) = parse_cookie_expires(val)
                    {
                        cookie.expires = Some(dt.to_rfc3339());
                    }
                }
                "max-age" => {
                    if !val.is_empty()
                        && let Ok(n) = val.parse::<i64>()
                    {
                        cookie.max_age = Some(n);
                    }
                }
                "samesite" => {
                    if !val.is_empty() {
                        let normalized = match val.to_ascii_lowercase().as_str() {
                            "lax" => "Lax".to_string(),
                            "strict" => "Strict".to_string(),
                            "none" => "None".to_string(),
                            other => other.to_string(),
                        };
                        cookie.same_site = Some(normalized);
                    }
                }
                _ => {}
            }
        }
    }
    Some(cookie)
}

/// Parse common cookie Expires formats and return UTC timestamp.
pub(crate) fn parse_cookie_expires(s: &str) -> Option<DateTime<Utc>> {
    const FMT_NETSCAPE: &str = "%a, %d-%b-%Y %H:%M:%S GMT";
    const FMT_RFC1123: &str = "%a, %d %b %Y %H:%M:%S GMT";
    const FMT_RFC850: &str = "%A, %d-%b-%y %H:%M:%S GMT";
    const FMT_ASCTIME: &str = "%a %b %e %H:%M:%S %Y";

    for fmt in [FMT_NETSCAPE, FMT_RFC1123, FMT_RFC850] {
        if let Ok(naive) = NaiveDateTime::parse_from_str(s, fmt) {
            return Some(DateTime::<Utc>::from_naive_utc_and_offset(naive, Utc));
        }
    }
    if let Ok(naive) = NaiveDateTime::parse_from_str(s, FMT_ASCTIME) {
        return Some(DateTime::<Utc>::from_naive_utc_and_offset(naive, Utc));
    }
    if let Ok(dt) = DateTime::parse_from_rfc2822(s) {
        return Some(dt.with_timezone(&Utc));
    }
    if let Ok(dt) = DateTime::parse_from_rfc3339(s) {
        return Some(dt.with_timezone(&Utc));
    }
    None
}

#[cfg(test)]
mod tests {
    use super::{parse_cookie_expires, parse_set_cookie_header};

    #[test]
    fn parses_basic_cookie_with_attrs() {
        let header = "sessionId=abc123; Domain=example.com; Path=/; Max-Age=3600; Secure; HttpOnly; SameSite=Lax; Expires=Wed, 21 Oct 2015 07:28:00 GMT";
        let c = parse_set_cookie_header(header).expect("cookie parsed");
        assert_eq!(c.name, "sessionId");
        assert_eq!(c.value, "abc123");
        assert_eq!(c.domain.as_deref(), Some("example.com"));
        assert_eq!(c.path.as_deref(), Some("/"));
        assert_eq!(c.max_age, Some(3600));
        assert_eq!(c.secure, Some(true));
        assert_eq!(c.http_only, Some(true));
        assert_eq!(c.same_site.as_deref(), Some("Lax"));
        assert!(
            c.expires.as_deref().unwrap().ends_with("Z")
                || c.expires.as_deref().unwrap().ends_with("+00:00")
        );
    }

    #[test]
    fn ignores_unknown_attributes_and_empty_pairs() {
        let header = "a=b; Foo=Bar; ; Baz; qux= ; SameSite=None";
        let c = parse_set_cookie_header(header).expect("cookie parsed");
        assert_eq!(c.name, "a");
        assert_eq!(c.value, "b");
        assert_eq!(c.same_site.as_deref(), Some("None"));
        assert_eq!(c.domain, None);
        assert_eq!(c.path, None);
    }

    #[test]
    fn parse_cookie_expires_multiple_formats() {
        let formats = [
            "Wed, 21 Oct 2015 07:28:00 GMT",     // RFC1123
            "Wed, 21-Oct-2015 07:28:00 GMT",     // Netscape
            "Wednesday, 21-Oct-15 07:28:00 GMT", // RFC850
            "Wed Oct 21 07:28:00 2015",          // asctime
            "Wed, 21 Oct 2015 07:28:00 +0000",   // RFC2822
            "2015-10-21T07:28:00Z",              // RFC3339
        ];
        for s in formats {
            assert!(parse_cookie_expires(s).is_some(), "failed to parse: {s}");
        }
    }

    #[test]
    fn rejects_empty_name_and_handles_trailing_semicolons() {
        assert!(parse_set_cookie_header("=value").is_none());
        let header = "foo=bar;;; SameSite=STRICT ; ";
        let c = parse_set_cookie_header(header).expect("cookie parsed");
        assert_eq!(c.name, "foo");
        assert_eq!(c.value, "bar");
        assert_eq!(c.same_site.as_deref(), Some("Strict"));
    }

    #[test]
    fn preserves_unknown_samesite_values_and_casing() {
        let c = parse_set_cookie_header("a=b; SameSite=Experimental").unwrap();
        // Unknown values are normalized to lowercase by the parser
        assert_eq!(c.same_site.as_deref(), Some("experimental"));
        let c2 = parse_set_cookie_header("a=b; SameSite=lAx").unwrap();
        assert_eq!(c2.same_site.as_deref(), Some("Lax"));
    }
}
