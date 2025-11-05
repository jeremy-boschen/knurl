use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use tokio_util::sync::CancellationToken;

static TOKENS: OnceLock<Mutex<HashMap<String, CancellationToken>>> = OnceLock::new();

fn tokens() -> &'static Mutex<HashMap<String, CancellationToken>> {
    TOKENS.get_or_init(|| Mutex::new(HashMap::new()))
}

pub fn register(id: &str) -> CancellationToken {
    let token = CancellationToken::new();
    let mut map = tokens().lock().unwrap();
    map.insert(id.to_string(), token.clone());
    token
}

pub fn cancel(id: &str) -> bool {
    let map = tokens().lock().unwrap();
    if let Some(token) = map.get(id) {
        token.cancel();
        true
    } else {
        false
    }
}

pub fn remove(id: &str) {
    let mut map = tokens().lock().unwrap();
    map.remove(id);
}

#[cfg(test)]
mod tests {
    use super::{cancel, register, remove, tokens};

    #[test]
    fn register_and_cancel_existing_token() {
        let id = "req-1";
        let token = register(id);
        assert!(!token.is_cancelled(), "token should start active");

        // Cancel should return true and token becomes cancelled
        assert!(cancel(id));
        assert!(
            token.is_cancelled(),
            "token should be cancelled after calling cancel"
        );

        // Cleanup
        remove(id);
        let map = tokens().lock().unwrap();
        assert!(!map.contains_key(id));
    }

    #[test]
    fn cancel_missing_id_returns_false() {
        // Ensure ID not present
        let id = "missing-123";
        {
            let mut map = tokens().lock().unwrap();
            map.remove(id);
        }
        assert!(!cancel(id));
    }

    #[test]
    fn remove_deletes_token_without_cancelling_new_one() {
        let id = "req-2";
        let token = register(id);
        assert!(!token.is_cancelled());
        remove(id);
        // After removal, token remains uncancelled but is no longer tracked
        assert!(!token.is_cancelled());
        let map = tokens().lock().unwrap();
        assert!(!map.contains_key(id));
    }

    #[test]
    fn re_register_same_id_overwrites_tracked_token() {
        let id = "dup-1";
        let old_token = register(id);
        assert!(!old_token.is_cancelled());
        // Re-register should replace the stored token with a new one
        let new_token = register(id);
        assert!(!new_token.is_cancelled());
        // Cancel should cancel only the latest one in the map
        assert!(cancel(id));
        assert!(new_token.is_cancelled());
        // Old token should remain unaffected because it's no longer tracked
        assert!(!old_token.is_cancelled());
        remove(id);
    }
}
