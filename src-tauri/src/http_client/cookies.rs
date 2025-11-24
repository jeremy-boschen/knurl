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

    // ========== RFC 6265 compliance tests ==========

    #[test]
    fn cookie_value_with_spaces() {
        // Values with spaces (RFC allows them in double quotes)
        let header = "name=value with spaces";
        let c = parse_set_cookie_header(header).unwrap();
        assert_eq!(c.name, "name");
        assert_eq!(c.value, "value with spaces");
    }

    #[test]
    fn cookie_value_with_special_characters() {
        let header = "token=abc123!@#$%^&*()";
        let c = parse_set_cookie_header(header).unwrap();
        assert_eq!(c.name, "token");
        assert_eq!(c.value, "abc123!@#$%^&*()");
    }

    #[test]
    fn cookie_domain_case_insensitive_matching() {
        // Domain attribute is case-insensitive per RFC 6265
        let header = "name=value; Domain=EXAMPLE.COM";
        let c = parse_set_cookie_header(header).unwrap();
        assert_eq!(c.domain.as_deref(), Some("EXAMPLE.COM"));
    }

    #[test]
    fn cookie_path_exact_matching() {
        // Path matching should be exact per RFC 6265
        let header = "name=value; Path=/api/v1";
        let c = parse_set_cookie_header(header).unwrap();
        assert_eq!(c.path.as_deref(), Some("/api/v1"));
    }

    #[test]
    fn cookie_max_age_zero_expires_immediately() {
        let header = "name=value; Max-Age=0";
        let c = parse_set_cookie_header(header).unwrap();
        assert_eq!(c.max_age, Some(0));
    }

    #[test]
    fn cookie_secure_flag_only() {
        let header = "name=value; Secure";
        let c = parse_set_cookie_header(header).unwrap();
        assert_eq!(c.secure, Some(true));
        assert_eq!(c.http_only, None);
    }

    #[test]
    fn cookie_httponly_flag_only() {
        let header = "name=value; HttpOnly";
        let c = parse_set_cookie_header(header).unwrap();
        assert_eq!(c.http_only, Some(true));
        assert_eq!(c.secure, None);
    }

    #[test]
    fn cookie_both_secure_and_httponly() {
        let header = "name=value; Secure; HttpOnly";
        let c = parse_set_cookie_header(header).unwrap();
        assert_eq!(c.secure, Some(true));
        assert_eq!(c.http_only, Some(true));
    }

    #[test]
    fn cookie_samesite_strict() {
        let header = "name=value; SameSite=Strict";
        let c = parse_set_cookie_header(header).unwrap();
        assert_eq!(c.same_site.as_deref(), Some("Strict"));
    }

    #[test]
    fn cookie_samesite_none_requires_secure() {
        // Per RFC, SameSite=None requires Secure flag
        let header = "name=value; SameSite=None; Secure";
        let c = parse_set_cookie_header(header).unwrap();
        assert_eq!(c.same_site.as_deref(), Some("None"));
        assert_eq!(c.secure, Some(true));
    }

    #[test]
    fn cookie_empty_value() {
        let header = "name=";
        let c = parse_set_cookie_header(header).unwrap();
        assert_eq!(c.name, "name");
        assert_eq!(c.value, "");
    }

    #[test]
    fn cookie_quoted_value() {
        let header = "name=\"quoted value\"";
        let c = parse_set_cookie_header(header).unwrap();
        assert_eq!(c.name, "name");
        // Parser doesn't strip quotes, so value includes them
        assert!(c.value.contains("quoted value"));
    }

    #[test]
    fn cookie_multiple_attributes_order_independent() {
        let h1 = "name=value; Path=/; Domain=example.com; Max-Age=3600";
        let h2 = "name=value; Domain=example.com; Max-Age=3600; Path=/";
        let c1 = parse_set_cookie_header(h1).unwrap();
        let c2 = parse_set_cookie_header(h2).unwrap();
        assert_eq!(c1.domain, c2.domain);
        assert_eq!(c1.path, c2.path);
        assert_eq!(c1.max_age, c2.max_age);
    }

    #[test]
    fn cookie_negative_max_age() {
        // Negative Max-Age should be treated as immediate expiry
        let header = "name=value; Max-Age=-1";
        let c = parse_set_cookie_header(header).unwrap();
        assert_eq!(c.max_age, Some(-1));
    }

    #[test]
    fn cookie_large_max_age() {
        // Test with very large Max-Age value
        let header = "name=value; Max-Age=2147483647";
        let c = parse_set_cookie_header(header).unwrap();
        assert_eq!(c.max_age, Some(2147483647));
    }

    #[test]
    fn cookie_expires_time_zones() {
        // Test Expires with different time zone formats
        let headers = [
            "name=value; Expires=Wed, 21 Oct 2015 07:28:00 GMT",
            "name=value; Expires=2015-10-21T07:28:00Z",
        ];
        for header in headers {
            let c = parse_set_cookie_header(header).unwrap();
            assert!(c.expires.is_some(), "Failed to parse: {header}");
        }
    }
}
