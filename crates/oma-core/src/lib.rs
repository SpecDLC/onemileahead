//! One Mile Ahead engine core. Pure Rust, no I/O: every entry point takes data and returns data.

pub mod ahead;
pub mod command;
pub mod geo;
pub mod index;
pub mod lookup;
pub mod marker;
pub mod nearby;
pub mod research;
pub mod search;
pub mod text;

pub use command::{handle, State};
pub use index::Engine;
pub use marker::Marker;
