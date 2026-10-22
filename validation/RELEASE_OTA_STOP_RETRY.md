# OTA automatic STOP retry — 2026-10-22

Flasher 1.5.38 and Fleet 1.0.14 keep the firmware safety gate intact while
recovering from a false `FE E0 09` response on older releases:

1. request STOP through the existing `AA 03` motor protocol;
2. require `AA 03 00` acknowledgement;
3. retry `FE 05` for up to six seconds while STOP settles;
4. never send START or firmware bytes while ENTER OTA remains refused;
5. report that one USB installation of V12.2.48 is required if the old gate
   remains blocked.

All portal tests, including 56 OTA completion/failure scenarios, pass.
