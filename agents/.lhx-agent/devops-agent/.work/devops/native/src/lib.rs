use napi_derive::napi;
use sha2::{Digest, Sha256};

/// 归一化文本：可选去除空白 / 转小写
#[napi(object)]
pub struct NormalizeOptions {
    pub trim: Option<bool>,
    pub lowercase: Option<bool>,
}

#[napi]
pub fn normalize(input: String, options: Option<NormalizeOptions>) -> String {
    let mut s = input;
    if let Some(opts) = options {
        if opts.trim.unwrap_or(false) {
            s = s.trim().to_string();
        }
        if opts.lowercase.unwrap_or(false) {
            s = s.to_lowercase();
        }
    }
    s
}

/// 统计 token 数量（简化实现：按空白分词 + 标点计数）
/// 生产环境可替换为 tiktoken-rs 等真实 tokenizer
#[napi]
pub fn count_tokens(input: String) -> u32 {
    let words = input.split_whitespace().count();
    let puncts = input.chars().filter(|c| c.is_ascii_punctuation()).count();
    (words + puncts) as u32
}

/// 计算 SHA-256 十六进制摘要
#[napi]
pub fn sha256_hex(input: String) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    let digest = hasher.finalize();
    digest.iter().map(|b| format!("{:02x}", b)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize() {
        assert_eq!(
            normalize(
                "  Hello  World  ".to_string(),
                Some(NormalizeOptions {
                    trim: Some(true),
                    lowercase: Some(true),
                })
            ),
            "hello  world"
        );
    }

    #[test]
    fn test_count_tokens() {
        assert_eq!(count_tokens("hello world".to_string()), 2);
    }

    #[test]
    fn test_sha256_hex() {
        // 已知向量：sha256("abc") = ba7816bf...
        assert_eq!(
            sha256_hex("abc".to_string()),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }
}
